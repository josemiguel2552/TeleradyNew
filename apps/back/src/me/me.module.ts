import { Module } from '@nestjs/common';
import { OrthancModule } from '../integrations/orthanc/orthanc.module';
import { MeController } from './v1/me.controller';
import { MeService } from './v1/me.service';
import { DicomExportService } from './v1/dicom-export.service';

@Module({
  imports: [OrthancModule],
  controllers: [MeController],
  providers: [MeService, DicomExportService],
})
export class MeModule {}
