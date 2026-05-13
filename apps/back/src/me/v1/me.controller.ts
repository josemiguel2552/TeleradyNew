import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { DicomExportService } from './dicom-export.service';
import { MeService } from './me.service';
import { ProcessingRestrictionDto } from './dto/restriction.dto';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly dicom: DicomExportService,
  ) {}

  @Get('dicom-export')
  // RGPD exports are heavy (ZIP everything the user touched) and easy
  // to weaponise as a DoS vector. 5/hour is generous: a real user
  // exporting weekly never sees the limit.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'RGPD art. 20 — download a ZIP with your DICOM studies' })
  dicomExport(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    return this.dicom.streamForCurrentUser(user, res);
  }

  @Get('data-export')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'RGPD art. 15 — download a copy of your personal data' })
  @ApiOkResponse({ description: 'application/json file download' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const payload = await this.me.export(user);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="telerady-data-export-${user.id}.json"`,
    );
    res.send(JSON.stringify(payload, null, 2));
  }

  @Patch('processing-restriction')
  @ApiOperation({ summary: 'RGPD art. 18 — toggle processing restriction' })
  async setRestriction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ProcessingRestrictionDto,
  ) {
    return this.me.setProcessingRestriction(user, body.restricted);
  }

  @Delete()
  @HttpCode(202)
  @ApiOperation({ summary: 'RGPD art. 17 — delete your account (logical tombstone)' })
  async delete(@CurrentUser() user: AuthenticatedUser) {
    return this.me.deleteAccount(user);
  }
}
