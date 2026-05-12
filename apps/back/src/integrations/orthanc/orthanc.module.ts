import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../../workflows/workflows.module';
import { DicomWebController } from './dicomweb.controller';
import { OrthancClient } from './orthanc-client.service';
import { PacsController } from './pacs.controller';
import { PacsIngestService } from './pacs-ingest.service';

@Module({
  imports: [WorkflowsModule],
  controllers: [DicomWebController, PacsController],
  providers: [OrthancClient, PacsIngestService],
  exports: [OrthancClient, PacsIngestService],
})
export class OrthancModule {}
