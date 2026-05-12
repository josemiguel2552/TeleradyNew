import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection, Socket } from 'node:net';
import { db } from '../../database/drizzle';
import { hl7MessageInTelerady } from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';

const VT = 0x0b;
const FS = 0x1c;
const CR = 0x0d;

/**
 * Outbound MLLP client. Sends a single message over a short-lived TCP
 * connection and waits for the ACK. Production wraps this with a queue
 * + retry policy (BullMQ); this commit ships the transport primitive.
 */
@Injectable()
export class Hl7MllpClient {
  private readonly logger = new Logger(Hl7MllpClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly enc: ColumnEncryptionService,
  ) {}

  async send(opts: {
    host: string;
    port: number;
    payload: string;
    hospitalId?: string | null;
    messageType: string;
    controlId?: string;
    timeoutMs?: number;
  }): Promise<{ ack: string }> {
    const aad = `hl7:out:${opts.controlId ?? 'unknown'}`;
    await db.insert(hl7MessageInTelerady).values({
      hospitalId: opts.hospitalId ?? null,
      direction: 'out',
      messageType: opts.messageType,
      controlId: opts.controlId ?? null,
      payloadEnc: this.enc.encrypt(opts.payload, aad),
    });

    return new Promise((resolve, reject) => {
      const timeoutMs = opts.timeoutMs ?? 10_000;
      let socket: Socket;
      try {
        socket = createConnection({ host: opts.host, port: opts.port });
      } catch (err) {
        reject(err);
        return;
      }
      let buffer = Buffer.alloc(0);
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`MLLP send timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      socket.on('connect', () => {
        socket.write(
          Buffer.concat([Buffer.from([VT]), Buffer.from(opts.payload, 'utf8'), Buffer.from([FS, CR])]),
        );
      });
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const start = buffer.indexOf(VT);
        const end = buffer.indexOf(FS);
        if (start >= 0 && end > start) {
          const ack = buffer.slice(start + 1, end).toString('utf8');
          clearTimeout(timer);
          socket.end();
          resolve({ ack });
        }
      });
      socket.on('error', (err) => {
        clearTimeout(timer);
        this.logger.warn(`MLLP send error to ${opts.host}:${opts.port}: ${err.message}`);
        reject(err);
      });
    });
  }
}
