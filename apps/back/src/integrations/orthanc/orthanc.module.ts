import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { WorkflowsModule } from '../../workflows/workflows.module';
import { DicomWebController } from './dicomweb.controller';
import { OrthancClient } from './orthanc-client.service';
import { PacsController } from './pacs.controller';
import { PacsIngestService } from './pacs-ingest.service';

@Module({
  imports: [WorkflowsModule, PushModule],
  controllers: [DicomWebController, PacsController],
  providers: [OrthancClient, PacsIngestService],
  exports: [OrthancClient, PacsIngestService],
})
export class OrthancModule {}
