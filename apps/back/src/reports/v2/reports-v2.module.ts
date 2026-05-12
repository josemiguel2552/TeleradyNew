import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { ReportV2Controller } from './report-v2.controller';
import { ReportV2Repository } from './report-v2.repository';
import { ReportV2Service } from './report-v2.service';
import { SignatureService } from './signature.service';
import { TsaService } from './tsa.service';

@Module({
  controllers: [ReportV2Controller],
  providers: [
    ReportV2Service,
    ReportV2Repository,
    SignatureService,
    TsaService,
    PdfService,
  ],
  exports: [ReportV2Service],
})
export class ReportsV2Module {}
