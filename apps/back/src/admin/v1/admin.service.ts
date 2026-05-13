import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { professionalInTelerady, reportStudyInTelerady } from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { PushService } from '../../integrations/push/push.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { AdminRepository } from './admin.repository';
import type { AssignStudyDto, AssignStudyResponseDto } from './dto/assign-study.dto';
import type { SlaDashboardDto } from './dto/sla.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly audit: AuditLogService,
    private readonly push: PushService,
  ) {}

  async assignStudy(
    reportStudyId: string,
    dto: AssignStudyDto,
    user: AuthenticatedUser,
  ): Promise<AssignStudyResponseDto> {
    const scope = TenantScope.for(user);
    const studyRows = await db
      .select({
        id: reportStudyInTelerady.id,
        hospitalId: reportStudyInTelerady.hospitalId,
        professionalId: reportStudyInTelerady.professionalId,
      })
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.id, reportStudyId))
      .limit(1);
    const study = studyRows[0];
    if (!study) throw new NotFoundException('Study not found');
    if (study.hospitalId && !scope.isPrivileged) scope.assertCanAct(study.hospitalId);

    const professional = await this.assertProfessionalExists(dto.professionalId);
    if (!professional) {
      throw new BadRequestException('Professional does not exist');
    }
    if (dto.reviewerProfessionalId) {
      const reviewer = await this.assertProfessionalExists(dto.reviewerProfessionalId);
      if (!reviewer) {
        throw new BadRequestException('Reviewer professional does not exist');
      }
      if (dto.reviewerProfessionalId === dto.professionalId) {
        throw new BadRequestException('Primary and reviewer must be different professionals');
      }
    }

    await db.transaction(async (tx) => {
      await this.repo.reassignStudy(tx, study.id, dto.professionalId);
      await this.audit.append(
        {
          actorId: user.id,
          actorRole: user.roles[0] ?? null,
          hospitalId: study.hospitalId,
          action: 'study.assigned',
          targetKind: 'ReportStudy',
          targetId: study.id,
          payload: {
            previousProfessionalId: study.professionalId,
            professionalId: dto.professionalId,
            reviewerProfessionalId: dto.reviewerProfessionalId ?? null,
          },
        },
        tx,
      );
    });

    // Notify the new primary radiologist out-of-band; never blocks the
    // assign response and never aborts on failure (push is best-effort).
    void this.push
      .sendToProfessional(dto.professionalId, {
        title: 'Estudio asignado',
        body: 'Tienes un estudio nuevo en tu worklist.',
        url: `/radiologist/study/${study.id}`,
        tag: `study-assigned-${study.id}`,
        category: 'study_assigned',
      })
      .catch(() => undefined);

    return {
      reportStudyId: study.id,
      professionalId: dto.professionalId,
      reviewerProfessionalId: dto.reviewerProfessionalId ?? null,
    };
  }

  async sla(
    user: AuthenticatedUser,
    hospitalId: string | undefined,
  ): Promise<SlaDashboardDto> {
    const scope = TenantScope.for(user);
    if (!scope.isPrivileged && !user.roles.includes('hospital_admin' as any)) {
      // Hospital admins get their own tenant data; everyone else must be
      // privileged (admin/coordinator).
      throw new ForbiddenException('Cannot read SLA dashboard');
    }
    return this.repo.slaDashboard(scope, hospitalId);
  }

  private async assertProfessionalExists(id: string): Promise<boolean> {
    const rows = await db
      .select({ id: professionalInTelerady.id })
      .from(professionalInTelerady)
      .where(eq(professionalInTelerady.id, id))
      .limit(1);
    return rows.length > 0;
  }
}
