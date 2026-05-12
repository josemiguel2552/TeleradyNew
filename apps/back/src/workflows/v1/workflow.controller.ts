import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { WorkflowAdminService } from './workflow-admin.service';
import {
  AssignmentRuleDto,
  AssignmentRuleResponseDto,
} from './dto/assignment-rule.dto';
import { ReviewReportDto } from './dto/review-report.dto';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: '', version: '1' })
export class WorkflowController {
  constructor(private readonly service: WorkflowAdminService) {}

  @Get('admin/assignment-rules')
  @Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin)
  @ApiOperation({ summary: 'List assignment rules visible to the actor' })
  @ApiOkResponse({ type: [AssignmentRuleResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listRules(user);
  }

  @Post('admin/assignment-rules')
  @Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin)
  @ApiOperation({ summary: 'Create an assignment rule' })
  @ApiCreatedResponse({ type: AssignmentRuleResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssignmentRuleDto,
  ) {
    return this.service.createRule(user, body);
  }

  @Delete('admin/assignment-rules/:id')
  @Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin)
  @ApiOperation({ summary: 'Delete an assignment rule' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteRule(user, id);
  }

  @Post('admin/sla/escalate')
  @Roles(Role.Admin, Role.Coordinator)
  @ApiOperation({
    summary: 'Audit-log SLA breaches as escalated (called by cron or by an operator)',
  })
  escalate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('minutes') minutes?: string,
  ) {
    const m = Math.max(15, Math.min(60 * 48, Number(minutes ?? 24 * 60)));
    return this.service.escalateBreaches(user, m);
  }

  @Post('reports/:reportStudyId/review')
  @Roles(Role.Radiologist, Role.Coordinator, Role.Admin)
  @ApiOperation({ summary: 'Second-read review of a report (approve / reject)' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportStudyId') reportStudyId: string,
    @Body() body: ReviewReportDto,
  ) {
    return this.service.review(user, reportStudyId, body);
  }
}
