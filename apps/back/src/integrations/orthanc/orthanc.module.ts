import { Module } from '@nestjs/common';
import { DicomWebController } from './dicomweb.controller';
import { OrthancClient } from './orthanc-client.service';
import { PacsController } from './pacs.controller';

@Module({
  controllers: [DicomWebController, PacsController],
  providers: [OrthancClient],
  exports: [OrthancClient],
})
export class OrthancModule {}
