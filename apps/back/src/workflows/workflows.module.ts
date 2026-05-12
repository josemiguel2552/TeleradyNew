import { Module } from '@nestjs/common';
import { WorkflowController } from './v1/workflow.controller';
import { WorkflowAdminService } from './v1/workflow-admin.service';
import { WorkflowEngine } from './v1/workflow-engine.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowAdminService, WorkflowEngine],
  exports: [WorkflowEngine],
})
export class WorkflowsModule {}
