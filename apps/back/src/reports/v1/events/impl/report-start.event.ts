import { IEvent } from "@nestjs/cqrs";
import { SaveReportDto } from "../../models/save-report.dto";

export class ReportStartEvent implements IEvent {
    constructor(public readonly data: SaveReportDto, public readonly action:string) { }
}