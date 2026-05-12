import { Module } from '@nestjs/common';
import { Hl7MllpClient } from './mllp-client';
import { Hl7MllpServer } from './mllp-server';
import { MwlController } from './mwl.controller';

@Module({
  controllers: [MwlController],
  providers: [Hl7MllpServer, Hl7MllpClient],
  exports: [Hl7MllpClient],
})
export class Hl7v2Module {}
