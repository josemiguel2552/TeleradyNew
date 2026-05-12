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
import { RegisterEventDto } from '../models/register-event.dto';
import { RegisterEventCommand } from '../commands/register-event.command';

@ApiTags('user-events')
@Controller({ path: 'user-events', version: '1' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Radiologist, Role.Coordinator, Role.Admin)
export class UserEventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly i18n: I18nService,
  ) {}

  @Put()
  @ApiOperation({ summary: 'save event of user' })
  @ApiCreatedResponse({ type: Base })
  async registerEvent(
    @Req() request: Request,
    @Body() data: RegisterEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Base> {
    this.i18n.setLang(request);
    return this.commandBus.execute(new RegisterEventCommand(data, user));
  }
}
