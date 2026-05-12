import { Module } from '@nestjs/common';
import { MeController } from './v1/me.controller';
import { MeService } from './v1/me.service';

@Module({
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
