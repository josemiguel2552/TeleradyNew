import { Module } from "@nestjs/common";
import { EventLogRepository } from "./event-log.repository";

@Module({
    providers: [EventLogRepository],
    exports: [EventLogRepository],
})
export class EventLogModule { }