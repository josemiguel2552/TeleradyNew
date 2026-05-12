import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { I18nService } from '../../i18n/i18n.service';
import { TenantScope } from '../../common/tenant/tenant-scope';
import { WorklistRepository } from './worklist.repository';
import {
  WorklistEntryDto,
  WorklistQueryDto,
  WorklistResponseDto,
} from './dto/worklist.dto';

@ApiTags('worklist')
@Controller({ path: 'worklist', version: '1' })
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Radiologist, Role.HospitalUser, Role.HospitalAdmin, Role.Coordinator, Role.Admin)
export class WorklistController {
  constructor(
    private readonly repository: WorklistRepository,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List worklist entries scoped to the actor' })
  @ApiOkResponse({ type: WorklistResponseDto })
  async list(
    @Query() query: WorklistQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<WorklistResponseDto> {
    this.i18n.setLang(request);
    return this.repository.list(TenantScope.for(user), query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return one worklist entry (decrypted patient fields)' })
  @ApiOkResponse({ type: WorklistEntryDto })
  async get(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorklistEntryDto> {
    const entry = await this.repository.findById(TenantScope.for(user), id);
    if (!entry) throw new NotFoundException('Study not visible');
    return entry;
  }
}
