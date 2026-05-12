import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { SaveReportCommand } from '../commands/save-report.command';
import { ReportStartEvent } from '../events/impl/report-start.event';
import { ReportRepository } from '../repositories/report.repository';
import { db } from '../../../database/drizzle';
import { I18nService } from '../../../i18n/i18n.service';
import { Base } from 'src/common/models/Base.model';
import type { AuthenticatedUser } from '../../../auth/jwt.strategy';
import { TenantScope } from '../../../common/tenant/tenant-scope';

@CommandHandler(SaveReportCommand)
export class SaveReportHandler implements ICommandHandler<SaveReportCommand> {
  constructor(
    private readonly eventBus: EventBus,
    private readonly reportRepository: ReportRepository,
    private readonly i18n: I18nService,
  ) {}

  async execute(command: SaveReportCommand): Promise<Base> {
    try {
      const { data, actor } = command;
      if (!actor.professionalId) {
        throw new ForbiddenException('Only a registered professional can save a report');
      }

      const scope = TenantScope.for(actor);
      const hospitalId = this.resolveHospitalId(actor, scope, data.hospitalId);

      return await db.transaction(async (tx) => {
        const existing = await this.reportRepository.findForProfessionalAndStudy(
          tx,
          scope,
          actor.professionalId!,
          data.studyId,
        );
        let action = 'update';
        let messageI18n = 'report.saveReport.update';
        if (existing) {
          await this.reportRepository.updateReport(tx, data, existing.id, {
            professionalId: actor.professionalId!,
            hospitalId,
          });
        } else {
          await this.reportRepository.insertReport(tx, data, {
            professionalId: actor.professionalId!,
            hospitalId,
          });
          action = 'insert';
          messageI18n = 'report.saveReport.save';
        }

        this.eventBus.publish(
          new ReportStartEvent({ ...data, idProfessional: actor.professionalId! }, action),
        );
        return { ok: true, message: this.i18n.translate(messageI18n) };
      });
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      console.error('SaveReportHandler', err);
      throw new InternalServerErrorException(
        this.i18n.translate('report.saveReport.errorMessage'),
      );
    }
  }

  private resolveHospitalId(
    actor: AuthenticatedUser,
    scope: TenantScope,
    requested: string | undefined,
  ): string | null {
    if (scope.isPrivileged) return requested ?? null;
    if (requested) {
      scope.assertCanAct(requested);
      return requested;
    }
    if (actor.hospitalIds.length === 1) return actor.hospitalIds[0];
    if (actor.hospitalIds.length === 0) {
      throw new ForbiddenException('No hospital membership; cannot save report');
    }
    throw new ForbiddenException(
      'hospitalId is required when the user belongs to multiple hospitals',
    );
  }
}
