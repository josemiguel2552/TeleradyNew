import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Hl7MllpClient } from '../../integrations/hl7v2/mllp-client';
import type { OruJobPayload } from '../jobs.service';

@Processor('oru-sender')
export class OruSenderWorker extends WorkerHost {
  private readonly logger = new Logger(OruSenderWorker.name);

  constructor(private readonly client: Hl7MllpClient) {
    super();
  }

  async process(job: Job<OruJobPayload>): Promise<{ ack: string }> {
    this.logger.log(
      `sending HL7 ${job.data.messageType} to ${job.data.host}:${job.data.port} (attempt ${job.attemptsMade + 1})`,
    );
    const { ack } = await this.client.send({
      host: job.data.host,
      port: job.data.port,
      payload: job.data.payload,
      hospitalId: job.data.hospitalId,
      controlId: job.data.controlId,
      messageType: job.data.messageType,
    });
    // The hospital's ACK message includes an MSA segment with AA/AE/AR.
    if (!/\bMSA\|AA/.test(ack)) {
      throw new Error(`HL7 receiver did not accept the message: ${ack.slice(0, 200)}`);
    }
    return { ack };
  }
}
