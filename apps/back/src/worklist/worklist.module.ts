import { Module } from '@nestjs/common';
import { WorklistController } from './v1/worklist.controller';
import { WorklistRepository } from './v1/worklist.repository';

@Module({
  controllers: [WorklistController],
  providers: [WorklistRepository],
  exports: [WorklistRepository],
})
export class WorklistModule {}
