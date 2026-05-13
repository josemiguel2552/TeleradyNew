import { Module } from '@nestjs/common';
import { PushMeController, PushPublicController } from './push.controller';
import { PushService } from './push.service';

@Module({
  controllers: [PushPublicController, PushMeController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
