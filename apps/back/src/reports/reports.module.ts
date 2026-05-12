import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { ReportController } from "./v1/controllers/report.controller";
import { ReportService } from "./v1/services/reports.service";
import { ReportRepository } from "./v1/repositories/report.repository";
import { SaveReportHandler } from "./v1/handlers/save-report.handler";
import { ReportStartHandler } from "./v1/events/handlers/report-start.handler";
import { EventLogModule } from "src/common/events/event-log.module";

const CommandHandlers = [SaveReportHandler];
const QueryHandlers = [];
const EventHandlers = [ReportStartHandler];

@Module({
  imports: [CqrsModule, EventLogModule],
  controllers: [ReportController],
  providers: [ReportService, ReportRepository, ...CommandHandlers, ...QueryHandlers, ...EventHandlers],
})
export class ReportModule { }