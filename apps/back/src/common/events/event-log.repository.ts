import { Injectable } from "@nestjs/common";
import { EventLog } from "../models/event-log.model";
import { DBOrTx } from "../../database/drizzle";
import { eventLogInTelerady } from "../../database/schema";

@Injectable()
export class EventLogRepository {
    constructor() { }

    async saveEvent(db: DBOrTx, data: EventLog) {
        await db.insert(eventLogInTelerady).values({
            eventPayload: data.eventPayload,
            eventType: data.eventType,
            professionalId: data.idProfessional
        }).execute();
    }
}