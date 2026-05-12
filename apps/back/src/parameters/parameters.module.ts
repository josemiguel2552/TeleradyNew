import { Module } from '@nestjs/common';
import { ParametersService } from './v1/services/parameters.service';
import { ParametersController } from './v1/controllers/parameters.controller';
import { CqrsModule } from '@nestjs/cqrs';
import { ParametersRepository } from './v1/repositories/parameters.repository';
import { GetSubspecialtiesHandler } from './v1/handlers/get-subspecialties.handler';

const CommandHandlers = [];
const QueryHandlers = [GetSubspecialtiesHandler,];

@Module({
  imports: [CqrsModule],
  controllers: [ParametersController],
  providers: [ParametersService, ParametersRepository, ...CommandHandlers, ...QueryHandlers],
})
export class ParametersModule { }
