import { Controller, Get, Req } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { I18nService } from '../../../i18n/i18n.service';
import { GetParameterResponse } from '../models/get-parameters.entity';
import { GetSubspecialtiesQuery } from '../queries/get-subspecialties.query';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';

@Controller({ path: 'parameters', version: '1' })
export class ParametersController {
  constructor(private readonly queryBus: QueryBus, private readonly i18n: I18nService) { }

  @Get('subspecialties')
  @ApiOperation({ summary: 'Get Subspecialties list' })
  @ApiCreatedResponse({ type: GetParameterResponse })
  async getSubspecialties(@Req() request: Request): Promise<GetParameterResponse> {
    this.i18n.setLang(request);
    const res = await this.queryBus.execute(new GetSubspecialtiesQuery());
    return res;
  }
}
