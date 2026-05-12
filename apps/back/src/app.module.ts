import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { I18nModule } from './i18n/i18n.module';
import { ParametersModule } from './parameters/parameters.module';
import { PersonalDataModule } from './personal-data/personal-data.module';
import { AuthModule } from './auth/auth.module';
import { ProfessionalDocumentModule } from './professional-document/professional-document.module';
import { ReportModule } from './reports/reports.module';
import { UserEventsModule } from './user-events/user-events.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    I18nModule,
    UserEventsModule,
    PersonalDataModule,
    ProfessionalDocumentModule,
    ReportModule,
    ParametersModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }
