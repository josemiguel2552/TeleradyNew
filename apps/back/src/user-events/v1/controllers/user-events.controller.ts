import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Base } from '../../../common/models/Base.model';
import { I18nService } from '../../../i18n/i18n.service';
import { RegisterEventDto } from '../models/register-event.dto';
import { RegisterEventCommand } from '../commands/register-event.command';

@Controller({ path: 'user-events', version: '1' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class UserEventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly i18n: I18nService,
  ) {}

  @Put()
  @ApiOperation({ summary: 'save event of user' })
  @ApiCreatedResponse({ type: Base })
  async registerEvent(@Req() request: Request, @Body() data: RegisterEventDto): Promise<Base> {
    this.i18n.setLang(request);
    const res = await this.commandBus.execute(new RegisterEventCommand(data));
    return res;
  }
}
