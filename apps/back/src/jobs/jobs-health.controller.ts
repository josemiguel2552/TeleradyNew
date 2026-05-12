import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/roles';

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator)
@Controller({ path: 'admin/jobs', version: '1' })
export class JobsHealthController {
  constructor(
    @InjectQueue('sla-escalation') private readonly sla: Queue,
    @InjectQueue('oru-sender') private readonly oru: Queue,
    @InjectQueue('webhook-delivery') private readonly webhooks: Queue,
    @InjectQueue('audit-verify') private readonly audit: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Per-queue counts to diagnose stuck jobs' })
  async status() {
    const queues = [this.sla, this.oru, this.webhooks, this.audit];
    const entries = await Promise.all(
      queues.map(async (q) => {
        const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        return { name: q.name, counts };
      }),
    );
    return { queues: entries };
  }
}
