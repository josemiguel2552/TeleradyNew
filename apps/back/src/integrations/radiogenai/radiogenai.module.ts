import { Module } from '@nestjs/common';
import { RadiogenAIClient } from './radiogenai.client';

@Module({
  providers: [RadiogenAIClient],
  exports: [RadiogenAIClient],
})
export class RadiogenAIModule {}
