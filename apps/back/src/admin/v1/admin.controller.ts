import {
  Body,
  Controller,
  Get,
  Param,
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { AdminService } from './admin.service';
import { AssignStudyDto, AssignStudyResponseDto } from './dto/assign-study.dto';
import { SlaDashboardDto, SlaQueryDto } from './dto/sla.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
}
