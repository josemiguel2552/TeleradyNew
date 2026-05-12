import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { hospitalInTelerady, professionalInTelerady, reportStudyInTelerady } from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { NotificationsService } from '../../integrations/notifications/notifications.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { Role } from '../../auth/roles';
import { PdfService } from './pdf.service';
import { ReportRow, ReportV2Repository, ReportStudyContext } from './report-v2.repository';
import { SignatureService } from './signature.service';
import { eq as eq2 } from 'drizzle-orm';
import type { ReportContentsDto } from './dto/save-report-v2.dto';
import type { SignReportDto } from './dto/sign-report.dto';
import type { ReportResponseDto } from './dto/report-response.dto';

const PDF_URL_TTL_SECONDS = 300;

@Injectable()
export class ReportV2Service {
  constructor(
    private readonly repo: ReportV2Repository,
    private readonly signatures: SignatureService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogService,
    private readonly enc: ColumnEncryptionService,
    private readonly notifications: NotificationsService,
  ) {}

  async get(reportStudyId: string, user: AuthenticatedUser): Promise<ReportResponseDto> {
    const scope = TenantScope.for(user);
    const study = await this.assertStudyVisible(reportStudyId, scope);
    const report = await this.repo.findByStudyId(scope, study.reportStudyId);
    if (!report) throw new NotFoundException('Report not started yet');
    return this.toResponse(report);
  }

  async saveDraft(
    reportStudyId: string,
    contents: ReportContentsDto,
    user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    if (!user.professionalId) {
      throw new ForbiddenException('Only a registered professional can edit a report');
    }
    const scope = TenantScope.for(user);
    const study = await this.assertStudyVisible(reportStudyId, scope);
    if (study.professionalId !== user.professionalId && !scope.isPrivileged) {
      throw new ForbiddenException('You are not assigned to this study');
    }

    const existing = await this.repo.findByStudyId(scope, reportStudyId);
    if (existing && (existing.state === 'signed' || existing.state === 'sent')) {
      throw new ConflictException(`Cannot edit a ${existing.state} report`);
    }

    const updated = await this.repo.upsertDraft(study, contents);
    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      hospitalId: study.hospitalId,
      action: existing ? 'report.draft_updated' : 'report.draft_created',
      targetKind: 'Report',
      targetId: updated.id,
      payload: { reportStudyId, version: updated.version },
    });
    return this.toResponse(updated);
  }

  async sign(
    reportStudyId: string,
    dto: SignReportDto,
    user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    if (!user.professionalId) {
      throw new ForbiddenException('Only a registered professional can sign a report');
    }
    const scope = TenantScope.for(user);
    const study = await this.assertStudyVisible(reportStudyId, scope);
    if (study.professionalId !== user.professionalId && !scope.isPrivileged) {
      throw new ForbiddenException('You are not assigned to this study');
    }
    if (!study.hospitalId) {
      throw new BadRequestException('Study has no hospital scope; cannot sign');
    }

    const policy = await this.repo.getHospitalPolicy(study.hospitalId);
    if (!policy) throw new NotFoundException('Hospital signature policy not set');

    const report = await this.repo.findByStudyId(scope, reportStudyId);
    if (!report) throw new NotFoundException('Cannot sign an empty report');
    if (report.state === 'signed' || report.state === 'sent') {
      throw new ConflictException(`Report is already ${report.state}`);
    }
    if (!report.contents) throw new BadRequestException('Cannot sign an empty report');

    const finalized = await this.repo.finalize(report.id);
    const { signatureData } = await this.signatures.sign(policy, finalized, dto);

    const study_ = await this.fetchPatientForPdf(reportStudyId);
    const enriched: ReportRow = { ...finalized, signatureData };
    const pdf = await this.pdf.render(enriched, study_);
    const signed = await this.repo.sign(report.id, signatureData, pdf);

    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      hospitalId: study.hospitalId,
      action: 'report.signed',
      targetKind: 'Report',
      targetId: signed.id,
      payload: {
        reportStudyId,
        version: signed.version,
        policy,
        pdfKey: pdf.key,
        contentsDigest: (signatureData as any).contentsDigest,
        tsaToken: (signatureData as any).tsa?.token ?? null,
      },
    });
    return this.toResponse(signed);
  }

  async send(reportStudyId: string, user: AuthenticatedUser): Promise<ReportResponseDto> {
    const scope = TenantScope.for(user);
    const study = await this.assertStudyVisible(reportStudyId, scope);
    if (!scope.isPrivileged && !user.roles.includes(Role.Coordinator) && !user.roles.includes(Role.Radiologist)) {
      throw new ForbiddenException('Cannot send report');
    }
    const report = await this.repo.findByStudyId(scope, reportStudyId);
    if (!report) throw new NotFoundException('Report not found');
    if (report.state !== 'signed') {
      throw new ConflictException('Report must be signed before sending');
    }
    const sent = await this.repo.markSent(report.id);
    await this.audit.append({
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      hospitalId: study.hospitalId,
      action: 'report.sent',
      targetKind: 'Report',
      targetId: sent.id,
      payload: { reportStudyId },
    });
    void this.notifyHospitalOnSent(sent).catch((err) => {
      // Best-effort; the audit row stays as the source of truth.
      // eslint-disable-next-line no-console
      console.warn('Failed to notify hospital webhook:', (err as Error).message);
    });
    return this.toResponse(sent);
  }

  private async notifyHospitalOnSent(report: ReportRow): Promise<void> {
    if (!report.hospitalId) return;
    const rows = await db
      .select({
        webhookUrl: hospitalInTelerady.name, // placeholder until the column lands
      })
      .from(hospitalInTelerady)
      .where(eq2(hospitalInTelerady.id, report.hospitalId))
      .limit(1);
    void rows; // hospital webhook URL field is added in the next iteration
    // Until hospital.webhook_url exists, route the event to the operator
    // email channel and let Sprint 8 wire the per-hospital configuration.
    await this.notifications.sendEmail({
      to: 'ops@telerady.es',
      subject: `Report sent: ${report.reportStudyId}`,
      text: `Report ${report.id} (v${report.version}) for study ${report.reportStudyId} was marked as sent.`,
    });
  }

  private async assertStudyVisible(
    reportStudyId: string,
    scope: TenantScope,
  ): Promise<ReportStudyContext> {
    const study = await this.repo.findStudyById(scope, reportStudyId);
    if (!study) throw new NotFoundException('Study not visible');
    return study;
  }

  private async fetchPatientForPdf(
    reportStudyId: string,
  ): Promise<{ name: string; birthdate: string | null }> {
    const rows = await db
      .select({
        patNameEnc: reportStudyInTelerady.patNameEnc,
        patBirthdateEnc: reportStudyInTelerady.patBirthdateEnc,
        professionalId: reportStudyInTelerady.professionalId,
      })
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.id, reportStudyId))
      .limit(1);
    const row = rows[0];
    if (!row) return { name: '—', birthdate: null };
    const aad = `report_study:${row.professionalId}`;
    return {
      name: this.enc.decryptIfPresent(row.patNameEnc, aad) ?? '—',
      birthdate: this.enc.decryptIfPresent(row.patBirthdateEnc, aad),
    };
  }

  private async toResponse(report: ReportRow): Promise<ReportResponseDto> {
    const pdfUrl =
      report.pdfBucket && report.pdfKey
        ? await this.storage.signedGetUrl(report.pdfKey, 'reports', PDF_URL_TTL_SECONDS)
        : null;
    return {
      id: report.id,
      reportStudyId: report.reportStudyId,
      state: report.state,
      version: report.version,
      hospitalId: report.hospitalId,
      professionalId: report.professionalId,
      contents: report.contents ?? null,
      signature: report.signatureData ?? null,
      signedAt: report.signedAt,
      sentAt: report.sentAt,
      pdfUrl,
    };
  }
}

void professionalInTelerady; // referenced in repository helpers