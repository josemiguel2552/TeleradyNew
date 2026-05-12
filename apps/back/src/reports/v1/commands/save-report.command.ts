import { SaveReportDto } from "../models/save-report.dto";

export class SaveReportCommand {
    constructor(public readonly data: SaveReportDto) { }
}