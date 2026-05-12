import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs";
import { SaveReportCommand } from "../commands/save-report.command";
import { InternalServerErrorException } from "@nestjs/common";
import { ReportStartEvent } from "../events/impl/report-start.event";
import { ReportRepository } from "../repositories/report.repository";
import { db } from "../../../database/drizzle";
import { I18nService } from "../../../i18n/i18n.service";
import { Base } from "src/common/models/Base.model";

@CommandHandler(SaveReportCommand)
export class SaveReportHandler implements ICommandHandler<SaveReportCommand> {
    constructor(private readonly eventBus: EventBus, private readonly reportRepository: ReportRepository, private readonly i18n: I18nService,) { }

    async execute(command: SaveReportCommand): Promise<Base> {
        try {
            const data = command.data;
            return await db.transaction(async (tx) => {
                const report = await this.reportRepository.getReport(tx, data.idProfessional, data.studyId);
                let action = 'update';
                let messageI18n = 'report.saveReport.update';
                if (report)
                    await this.reportRepository.updateReport(tx, data, report.id);
                else {
                    await this.reportRepository.insertReport(tx, data);
                    action = 'insert';
                    messageI18n = 'report.saveReport.save';
                }

                this.eventBus.publish(new ReportStartEvent(data, action));
                return { ok: true, message: this.i18n.translate(messageI18n) };
            });
        }
        catch (err) {
            console.error('SaveReportHandler', err);
            throw new InternalServerErrorException(
                this.i18n.translate('report.saveReport.errorMessage')
            );
        }
    }
}