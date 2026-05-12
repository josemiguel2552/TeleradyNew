import { Module } from '@nestjs/common';
import { DicomWebController } from './dicomweb.controller';
import { OrthancClient } from './orthanc-client.service';
import { PacsController } from './pacs.controller';
import { PacsIngestService } from './pacs-ingest.service';

@Module({
  controllers: [DicomWebController, PacsController],
  providers: [OrthancClient, PacsIngestService],
  exports: [OrthancClient, PacsIngestService],
})
export class OrthancModule {}
