import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import { OrthancClient } from './orthanc-client.service';
import { StudySearchDto, StudySearchResultDto } from './dto/study-search.dto';

@ApiTags('pacs')
@Controller({ path: 'pacs', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin, Role.HospitalUser, Role.Radiologist)
@ApiBearerAuth()
export class PacsController {
  private readonly viewerBase: string;
  private readonly viewerPath: string;

  constructor(
    private readonly orthanc: OrthancClient,
    config: ConfigService,
  ) {
    this.viewerBase = config.get<string>('OHIF_URL') ?? '';
    this.viewerPath = config.get<string>('OHIF_VIEWER_PATH') ?? '/viewer';
  }

  @Post('studies/search')
  @ApiOperation({
    summary: 'Search studies in the PACS by filters (returns a normalised list)',
  })
  @ApiOkResponse({ type: [StudySearchResultDto] })
  async searchStudies(@Body() body: StudySearchDto): Promise<StudySearchResultDto[]> {
    const queryParts: string[] = [
      '/qido-rs/studies',
      `?limit=${body.limit ?? 50}`,
      `&offset=${body.offset ?? 0}`,
    ];
    if (body.modality) queryParts.push(`&ModalitiesInStudy=${encodeURIComponent(body.modality)}`);
    if (body.studyDateFrom || body.studyDateTo) {
      const from = body.studyDateFrom ?? '';
      const to = body.studyDateTo ?? '';
      queryParts.push(`&StudyDate=${encodeURIComponent(`${from}-${to}`)}`);
    }
    if (body.accessionNumber) {
      queryParts.push(`&AccessionNumber=${encodeURIComponent(body.accessionNumber)}`);
    }
    const upstream = await this.orthanc.proxy('GET', queryParts.join(''), {
      Accept: 'application/dicom+json',
    });
    if (upstream.status >= 400 || !upstream.body) return [];
    const text = await new Response(upstream.body).text();
    const json: DicomJsonStudy[] = text ? JSON.parse(text) : [];
    return json.map(normaliseStudy);
  }

  @Get('viewer/:studyInstanceUid')
  @ApiOperation({
    summary: 'Build the OHIF viewer URL for the given study (signed query string)',
  })
  viewerUrl(
    @Param('studyInstanceUid') studyInstanceUid: string,
  ): { url: string } {
    const url = `${this.viewerBase}${this.viewerPath}?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;
    return { url };
  }
}

interface DicomJsonStudy {
  '0020000D'?: { Value: string[] };
  '00080020'?: { Value: string[] };
  '00081030'?: { Value: string[] };
  '00080050'?: { Value: string[] };
  '00080090'?: { Value: string[] };
  '00080061'?: { Value: string[] };
  '00080080'?: { Value: string[] };
}

function tag(study: DicomJsonStudy, key: keyof DicomJsonStudy): string | null {
  return study[key]?.Value?.[0] ?? null;
}

function normaliseStudy(study: DicomJsonStudy): StudySearchResultDto {
  return {
    studyInstanceUid: tag(study, '0020000D') ?? '',
    studyDescription: tag(study, '00081030'),
    studyDate: tag(study, '00080020'),
    accessionNumber: tag(study, '00080050'),
    institution: tag(study, '00080080'),
    modalities: (study['00080061']?.Value ?? []).flatMap((v) =>
      v.split(/[\\,]/).filter(Boolean),
    ),
  };
}
