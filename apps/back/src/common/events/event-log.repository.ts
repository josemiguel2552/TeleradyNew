import { Injectable } from '@nestjs/common';
import { EventLog } from '../models/event-log.model';
import { DBOrTx } from '../../database/drizzle';
import { eventLogInTelerady } from '../../database/schema';
import { PseudonymService } from '../crypto/pseudonym.service';

// Keys we strip or replace before persisting an event_log payload. The list
// is intentionally generous: easier to maintain than parsing the payload
// schema-by-schema, and it errs on the side of dropping than leaking.
const PII_KEYS_TO_PSEUDONYMIZE = new Set([
  'patid',
  'pat_id',
  'patientid',
  'patient_id',
]);
const PII_KEYS_TO_REDACT = new Set([
  'patname',
  'pat_name',
  'patientname',
  'patient_name',
  'patbirthdate',
  'pat_birthdate',
  'birthdate',
  'phone',
  'email',
  'dni',
  'nie',
  'iban',
  'bank_account',
  'bankaccount',
]);

@Injectable()
export class EventLogRepository {
  constructor(private readonly pseudonym: PseudonymService) {}

  async saveEvent(db: DBOrTx, data: EventLog) {
    const sanitised = this.sanitise(data.eventPayload);
    await db
      .insert(eventLogInTelerady)
      .values({
        eventPayload: sanitised,
        eventType: data.eventType,
        professionalId: data.idProfessional,
      })
      .execute();
  }

  sanitise(payload: unknown): unknown {
    if (payload === null || typeof payload !== 'object') return payload;
    if (Array.isArray(payload)) return payload.map((v) => this.sanitise(v));

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (PII_KEYS_TO_PSEUDONYMIZE.has(lower) && typeof value === 'string') {
        out[key] = this.pseudonym.hash(value);
      } else if (PII_KEYS_TO_REDACT.has(lower)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = this.sanitise(value);
      }
    }
    return out;
  }
}
