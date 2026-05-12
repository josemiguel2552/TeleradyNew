import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { ReportStartEvent } from "../impl/report-start.event";
import { EventLogRepository } from "../../../../common/events/event-log.repository";
import { db } from "../../../../database/drizzle";
import { EventLog } from "../../../../common/models/event-log.model";
import { ReportEventType } from "../../../../common/constants/event-type.enum";

@EventsHandler(ReportStartEvent)
export class ReportStartHandler implements IEventHandler<ReportStartEvent> {

    constructor(private readonly eventLogRepository: EventLogRepository) { }

    async handle(event: ReportStartEvent) {
        try {
            await db.transaction(async (tx) => {
                const data = event.data;
                const dataEvent: EventLog = {
                    eventType: ReportEventType.START,
                    idProfessional: data.idProfessional,
                    eventPayload: { action: event.action, ...data },
                };
                await this.eventLogRepository.saveEvent(tx, dataEvent);
            });
        }
        catch (err) {
            console.error('ReportStartHandler - Event', err);
        }
    }
}