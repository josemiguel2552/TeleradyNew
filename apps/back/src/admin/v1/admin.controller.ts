import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { TenantScope } from '../../common/tenant/tenant-scope';
import { AdminService } from './admin.service';
import { AdminQueryRepository } from './admin-query.repository';
import { AssignStudyDto, AssignStudyResponseDto } from './dto/assign-study.dto';
import { SlaDashboardDto, SlaQueryDto } from './dto/sla.dto';
import { AuditListDto, AuditQueryDto, AuditVerifyResultDto } from './dto/audit.dto';
import { ProfessionalListDto, ProfessionalQueryDto } from './dto/professional.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  private readonly auditSeed: string | null;

  constructor(
    private readonly admin: AdminService,
    private readonly queries: AdminQueryRepository,
    config: ConfigService,
  ) {
    this.auditSeed = config.get<string>('AUDIT_HASH_CHAIN_SEED') ?? null;
  }

  @Put('studies/:id/assign')
  @Roles(Role.Admin, Role.Coordinator)
  @ApiOperation({ summary: 'Assign a study to a primary radiologist (and an optional reviewer)' })
  @ApiOkResponse({ type: AssignStudyResponseDto })
  assign(
    @Param('id') id: string,
    @Body() body: AssignStudyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignStudyResponseDto> {
    return this.admin.assignStudy(id, body, user);
  }

  @Get('dashboard/sla')
  @ApiOperation({ summary: 'SLA dashboard scoped to the actor (counts + averages + overdue)' })
  @ApiOkResponse({ type: SlaDashboardDto })
  sla(
    @Query() query: SlaQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SlaDashboardDto> {
    return this.admin.sla(user, query.hospitalId);
  }

  @Get('audit')
  @ApiOperation({ summary: 'List audit log entries (paginated, scoped by tenant)' })
  @ApiOkResponse({ type: AuditListDto })
  listAudit(
    @Query() query: AuditQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuditListDto> {
    return this.queries.listAudit(TenantScope.for(user), query);
  }

  @Post('audit/verify')
  @Roles(Role.Admin, Role.Coordinator)
  @ApiOperation({ summary: 'Replay the audit log hash chain and report tampering' })
  @ApiOkResponse({ type: AuditVerifyResultDto })
  verifyAudit(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuditVerifyResultDto> {
    return this.queries.verifyAudit(TenantScope.for(user), this.auditSeed);
  }

  @Get('professionals')
  @ApiOperation({ summary: 'Search professionals to use in assignments' })
  @ApiOkResponse({ type: ProfessionalListDto })
  listProfessionals(
    @Query() query: ProfessionalQueryDto,
  ): Promise<ProfessionalListDto> {
    return this.queries.listProfessionals(query);
  }
}
