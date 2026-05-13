import { IEvent } from "@nestjs/cqrs";
import { SaveReportDto } from "../../models/save-report.dto";

export type ReportStartEventData = SaveReportDto & { idProfessional: string };

export class ReportStartEvent implements IEvent {
    constructor(
        public readonly data: ReportStartEventData,
        public readonly action: string,
    ) { }
}