import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { I18nService } from '../../../i18n/i18n.service';
import { SaveReportDto } from '../models/save-report.dto';
import { SaveReportCommand } from '../commands/save-report.command';
import { Base } from '../../../common/models/Base.model';

@Controller({ path: 'report', version: '1' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class ReportController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly i18n: I18nService,
  ) {}

  @Put()
  @ApiOperation({ summary: 'save and upload report' })
  @ApiCreatedResponse({ type: Base })
  async saveReport(@Req() request: Request, @Body() data: SaveReportDto): Promise<Base> {
    this.i18n.setLang(request);
    const res = await this.commandBus.execute(new SaveReportCommand(data));
    return res;
  }
}
