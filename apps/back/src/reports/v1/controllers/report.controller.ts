import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Role } from '../../../auth/roles';
import type { AuthenticatedUser } from '../../../auth/jwt.strategy';
import { Base } from '../../../common/models/Base.model';
import { I18nService } from '../../../i18n/i18n.service';
import { SaveReportCommand } from '../commands/save-report.command';
import { SaveReportDto } from '../models/save-report.dto';

@ApiTags('reports')
@Controller({ path: 'report', version: '1' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator, Role.Radiologist)
export class ReportController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly i18n: I18nService,
  ) {}

  @Put()
  @ApiOperation({ summary: 'save and upload report' })
  @ApiCreatedResponse({ type: Base })
  async saveReport(
    @Req() request: Request,
    @Body() data: SaveReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Base> {
    this.i18n.setLang(request);
    return this.commandBus.execute(new SaveReportCommand(data, user));
  }
}
