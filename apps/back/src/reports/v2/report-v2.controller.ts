import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { SaveReportV2Dto } from './dto/save-report-v2.dto';
import { SignReportDto } from './dto/sign-report.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { ReportV2Service } from './report-v2.service';

@ApiTags('reports-v2')
@Controller({ path: 'reports', version: '2' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Radiologist, Role.Coordinator, Role.Admin)
export class ReportV2Controller {
  constructor(private readonly service: ReportV2Service) {}

  @Get(':reportStudyId')
  @ApiOperation({ summary: 'Get the structured report (decrypted) for a study' })
  @ApiOkResponse({ type: ReportResponseDto })
  get(
    @Param('reportStudyId') reportStudyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.get(reportStudyId, user);
  }

  @Put(':reportStudyId')
  @ApiOperation({ summary: 'Autosave the report draft (encrypted at rest)' })
  @ApiOkResponse({ type: ReportResponseDto })
  save(
    @Param('reportStudyId') reportStudyId: string,
    @Body() body: SaveReportV2Dto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.saveDraft(reportStudyId, body.contents, user);
  }

  @Post(':reportStudyId/sign')
  @ApiOperation({ summary: 'Sign the report using the hospital policy' })
  @ApiOkResponse({ type: ReportResponseDto })
  sign(
    @Param('reportStudyId') reportStudyId: string,
    @Body() body: SignReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.sign(reportStudyId, body, user);
  }

  @Post(':reportStudyId/send')
  @ApiOperation({ summary: 'Mark the report as sent to the hospital' })
  @ApiOkResponse({ type: ReportResponseDto })
  send(
    @Param('reportStudyId') reportStudyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportResponseDto> {
    return this.service.send(reportStudyId, user);
  }
}
