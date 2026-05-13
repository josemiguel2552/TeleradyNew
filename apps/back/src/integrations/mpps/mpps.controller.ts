import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/auth/api-key.guard';
import { MppsEventDto, MppsEventResponseDto } from './dto/mpps-event.dto';
import { MppsService } from './mpps.service';

@ApiTags('integrations')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller({ path: 'integrations/orthanc', version: '1' })
export class MppsController {
  constructor(private readonly mpps: MppsService) {}

  @Post('mpps')
  @ApiOperation({
    summary:
      'Ingest a DICOM MPPS event (N-CREATE / N-SET) forwarded by Orthanc. ' +
      'Server-to-server: requires the shared INTEGRATION_API_KEY in x-api-key.',
  })
  @ApiOkResponse({ type: MppsEventResponseDto })
  ingest(@Body() body: MppsEventDto): Promise<MppsEventResponseDto> {
    return this.mpps.ingest(body);
  }
}
