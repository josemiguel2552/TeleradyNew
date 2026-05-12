import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { and, eq, type SQL } from 'drizzle-orm';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { db } from '../../database/drizzle';
import { mwlEntryInTelerady } from '../../database/schema';
import { ColumnEncryptionService } from '../../common/crypto/column-encryption.service';
import { TenantScope } from '../../common/tenant/tenant-scope';

class MwlCreateDto {
  @IsString() @MaxLength(64) accessionNumber!: string;
  @IsString() @MaxLength(150) patientId!: string;
  @IsString() @MaxLength(150) patientName!: string;
  @IsString() @MaxLength(8) patientBirthdate!: string;
  @IsString() @IsIn(['M', 'F', 'O', 'U']) patientSex!: string;
  @IsString() @MaxLength(20) modality!: string;
  @IsString() @MaxLength(150) studyDescription!: string;
  @IsString() @MaxLength(8) scheduledDate!: string;
  @IsString() @MaxLength(6) scheduledTime!: string;
  @IsOptional() @IsString() @MaxLength(150) requestingPhysician?: string;
  @IsOptional() @IsString() @MaxLength(16) scheduledStationAet?: string;
}

class MwlQueryDto {
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() patientIdHash?: string;
}

@ApiTags('mwl')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin)
@Controller({ path: 'mwl', version: '1' })
export class MwlController {
  constructor(private readonly enc: ColumnEncryptionService) {}

  @Get()
  @ApiOperation({ summary: 'List MWL entries scoped to the actor' })
  @ApiOkResponse()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MwlQueryDto,
  ) {
    const scope = TenantScope.for(user);
    const tenant = scope.whereHospital(mwlEntryInTelerady.hospitalId);
    const conditions: SQL[] = [];
    if (tenant) conditions.push(tenant);
    if (query.state) conditions.push(eq(mwlEntryInTelerady.state, query.state));
    if (query.patientIdHash) conditions.push(eq(mwlEntryInTelerady.patientIdHash, query.patientIdHash));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(mwlEntryInTelerady).where(where).limit(200);
    return rows.map((row) => {
      const aad = `mwl:${row.accessionNumber}`;
      return {
        id: row.id,
        accessionNumber: row.accessionNumber,
        modality: row.modality,
        studyDescription: row.studyDescription,
        scheduledDate: row.scheduledDate,
        scheduledTime: row.scheduledTime,
        state: row.state,
        patientName: this.enc.decryptIfPresent(row.patientNameEnc, aad),
        patientBirthdate: this.enc.decryptIfPresent(row.patientBirthdateEnc, aad),
        requestingPhysician: row.requestingPhysician,
        hospitalId: row.hospitalId,
        createdAt: row.createdAt,
      };
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Create a MWL entry manually (the HL7 listener creates them too)',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MwlCreateDto,
  ) {
    const scope = TenantScope.for(user);
    const hospitalId = scope.isPrivileged ? null : user.hospitalIds[0] ?? null;
    if (!scope.isPrivileged && !hospitalId) {
      throw new Error('No hospital scope for MWL creation');
    }
    const aad = `mwl:${dto.accessionNumber}`;
    const [row] = await db
      .insert(mwlEntryInTelerady)
      .values({
        hospitalId,
        accessionNumber: dto.accessionNumber,
        patientIdEnc: this.enc.encrypt(dto.patientId, aad),
        patientIdHash: this.enc.lookupHash(dto.patientId),
        patientNameEnc: this.enc.encrypt(dto.patientName, aad),
        patientBirthdateEnc: this.enc.encrypt(dto.patientBirthdate, aad),
        patientSex: dto.patientSex,
        studyDescription: dto.studyDescription,
        scheduledDate: dto.scheduledDate,
        scheduledTime: dto.scheduledTime,
        modality: dto.modality,
        requestingPhysician: dto.requestingPhysician ?? null,
        scheduledStationAet: dto.scheduledStationAet ?? null,
      })
      .returning({ id: mwlEntryInTelerady.id });
    return { id: row.id };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled MWL entry' })
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const scope = TenantScope.for(user);
    void scope;
    await db
      .update(mwlEntryInTelerady)
      .set({ state: 'cancelled' })
      .where(eq(mwlEntryInTelerady.id, id));
    return { id, state: 'cancelled' };
  }
}
