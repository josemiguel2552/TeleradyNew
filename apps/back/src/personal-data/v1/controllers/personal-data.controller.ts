import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { I18nService } from '../../../i18n/i18n.service';
import { ValidateResponse } from '../models/validate.entity';
import { ValidateQuery } from '../queries/validate.query';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SaveProfessionalResponse } from '../models/save-professional.entity';
import { SaveProfessionalDto } from '../models/save-professional.dto';
import { SaveProfessionalCommand } from '../commands/save-professional.command';
import { AuthGuard } from '@nestjs/passport';

@Controller({ path: 'personal-data', version: '1' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class PersonalDataController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus, private readonly i18n: I18nService) { }

  @Put()
  @ApiOperation({ summary: 'save info user' })
  @ApiCreatedResponse({ type: SaveProfessionalResponse })
  async saveProfessional(@Req() request: Request, @Body() body: SaveProfessionalDto): Promise<SaveProfessionalResponse> {
    this.i18n.setLang(request);
    const res = await this.commandBus.execute(new SaveProfessionalCommand(body));
    return res;
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate user' })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiCreatedResponse({ type: ValidateResponse })
  async validateProfessional(@Req() request: Request, @Query('email') email: string): Promise<ValidateResponse> {
    this.i18n.setLang(request);
    const res = await this.queryBus.execute(new ValidateQuery(email));
    return res;
  }

}
