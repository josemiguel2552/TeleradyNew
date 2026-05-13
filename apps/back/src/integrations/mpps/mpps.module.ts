import { Module } from '@nestjs/common';
import { MppsController } from './mpps.controller';
import { MppsService } from './mpps.service';

@Module({
  controllers: [MppsController],
  providers: [MppsService],
})
export class MppsModule {}
