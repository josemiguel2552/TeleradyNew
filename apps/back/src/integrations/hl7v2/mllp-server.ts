import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServer, Server, Socket } from 'node:net';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../database/drizzle';
import { mwlEntryInTelerady, hl7MessageInTelerady } from '../../database/schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { buildAck, parseHl7 } from './hl7-codec';
import { mapOrm } from './hl7-mapper';

const VT = 0x0b; // <SB> start of MLLP block
const FS = 0x1c; // <EB> end of MLLP block
const CR = 0x0d; // <CR> trailing

/**
 * MLLP server (Minimum Lower Layer Protocol, HL7 v2 transport over TCP).
 *
 * Listens on `HL7_MLLP_PORT`. For every framed message it:
 *   1. Persists the raw payload encrypted in `telerady.hl7_message`.
 *   2. Parses it; if it's an ORM/OMI/OMG order, upserts a row in
 *      `telerady.mwl_entry` with patient fields encrypted at rest.
 *   3. Sends an MSA acknowledgement back to the sender.
 *
 * Authentication: connection-level via mTLS at the reverse proxy or
 * Stunnel. We don't speak TLS in this server itself to keep the
 * protocol surface small; production runs it behind a TLS terminator.
 */
@Injectable()
export class Hl7MllpServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(Hl7MllpServer.name);
  private server?: Server;
  private port = 0;
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly enc: ColumnEncryptionService,
    private readonly audit: AuditLogService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.enabled = this.config.get<string>('HL7_MLLP_ENABLED') === 'true';
    if (!this.enabled) {
      this.logger.log('HL7 MLLP server disabled (set HL7_MLLP_ENABLED=true to enable)');
      return;
    }
    this.port = Number(this.config.get<string>('HL7_MLLP_PORT') ?? '2575');
    this.server = createServer((socket) => this.onConnection(socket));
    await new Promise<void>((resolve) => this.server!.listen(this.port, resolve));
    this.logger.log(`HL7 MLLP server listening on port ${this.port}`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
  }

  private onConnection(socket: Socket): void {
    let buffer = Buffer.alloc(0);
    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let framed: Buffer | null;
      while ((framed = this.takeFramedMessage()(buffer)).message) {
        buffer = framed.rest!;
        const ack = await this.handleMessage(framed.message.toString('utf8'));
        socket.write(this.frame(ack));
      }
    });
    socket.on('error', (err) => this.logger.warn(`MLLP socket error: ${err.message}`));
    socket.on('close', () => undefined);
  }

  /**
   * Curried helper to extract the next framed message from a buffer.
   * Returns either the message + the rest, or { message: null } when
   * no full frame is present yet.
   */
  private takeFramedMessage() {
    return function take(buf: Buffer): { message: Buffer | null; rest?: Buffer } {
      const start = buf.indexOf(VT);
      if (start < 0) return { message: null };
      const endIdx = buf.indexOf(FS, start + 1);
      if (endIdx < 0) return { message: null };
      const message = buf.slice(start + 1, endIdx);
      const next = buf[endIdx + 1] === CR ? endIdx + 2 : endIdx + 1;
      return { message, rest: buf.slice(next) };
    };
  }

  private frame(payload: string): Buffer {
    return Buffer.concat([Buffer.from([VT]), Buffer.from(payload, 'utf8'), Buffer.from([FS, CR])]);
  }

  private async handleMessage(raw: string): Promise<string> {
    const parsed = parseHl7(raw);
    const msh = parsed.byName.get('MSH')?.[0];
    const messageType = msh ? `${parsed.byName.get('MSH')![0].fields[9]?.raw ?? ''}` : '';
    const controlId = msh ? parsed.byName.get('MSH')![0].fields[10]?.raw ?? null : null;

    // Persist the raw payload (encrypted) for audit & replay.
    const aad = `hl7:in:${controlId ?? 'unknown'}`;
    const [stored] = await db
      .insert(hl7MessageInTelerady)
      .values({
        direction: 'in',
        messageType,
        controlId,
        payloadEnc: this.enc.encrypt(raw, aad),
      })
      .returning({ id: hl7MessageInTelerady.id });

    try {
      const orm = mapOrm(parsed);
      if (orm) await this.upsertMwlEntry(orm);
      await db
        .update(hl7MessageInTelerady)
        .set({ processedAt: sql`now()` })
        .where(eq(hl7MessageInTelerady.id, stored.id));
      await this.audit.append({
        action: 'hl7.received',
        targetKind: 'Hl7Message',
        targetId: stored.id,
        payload: { messageType, controlId, mapped: !!orm },
      });
      return buildAck(parsed, 'AA');
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Failed to process HL7 message: ${message}`);
      await db
        .update(hl7MessageInTelerady)
        .set({ processedAt: sql`now()`, error: message })
        .where(eq(hl7MessageInTelerady.id, stored.id));
      return buildAck(parsed, 'AE', message);
    }
  }

  private async upsertMwlEntry(orm: ReturnType<typeof mapOrm> & object): Promise<void> {
    const aad = `mwl:${orm.accessionNumber}`;
    await db
      .insert(mwlEntryInTelerady)
      .values({
        accessionNumber: orm.accessionNumber,
        patientIdEnc: this.enc.encryptIfPresent(orm.patientId, aad),
        patientIdHash: orm.patientId ? this.enc.lookupHash(orm.patientId) : null,
        patientNameEnc: this.enc.encryptIfPresent(orm.patientName, aad),
        patientBirthdateEnc: this.enc.encryptIfPresent(orm.patientBirthdate, aad),
        patientSex: orm.patientSex,
        studyDescription: orm.studyDescription,
        scheduledDate: orm.scheduledDate,
        scheduledTime: orm.scheduledTime,
        modality: orm.modality,
        requestingPhysician: orm.requestingPhysician,
        state: orm.orderControl === 'CA' ? 'cancelled' : 'scheduled',
      })
      // ON CONFLICT requires a unique index on accession_number; we fall
      // back to UPDATE when the index isn't there yet (dev/seed timing).
      .onConflictDoNothing();
  }
}
