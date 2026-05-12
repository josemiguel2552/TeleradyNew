import { Module } from '@nestjs/common';
import { PersonalDataService } from './v1/services/personal-data.service';
import { PersonalDataController } from './v1/controllers/personal-data.controller';
import { CqrsModule } from '@nestjs/cqrs';
import { PersonalDataRepository } from './v1/repositories/personal-data.repository';
import { ValidateHandler } from './v1/handlers/validate.handler';
import { SaveProfessionalHandler } from './v1/handlers/save-professional.handler';
import { DriveModule } from '../integrations/google/drive.module'; 

const CommandHandlers = [SaveProfessionalHandler];
const QueryHandlers = [ValidateHandler,];

@Module({
  imports: [CqrsModule,DriveModule],
  controllers: [PersonalDataController],
  providers: [PersonalDataService, PersonalDataRepository, ...CommandHandlers, ...QueryHandlers],
})
export class PersonalDataModule { }
