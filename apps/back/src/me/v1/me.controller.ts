import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('data-export')
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

  @Delete()
  @HttpCode(202)
  @ApiOperation({ summary: 'RGPD art. 17 — delete your account (logical tombstone)' })
  async delete(@CurrentUser() user: AuthenticatedUser) {
    return this.me.deleteAccount(user);
  }
}
