import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { FhirService } from './fhir.service';

/**
 * FHIR R4 read endpoints exposed by the platform.
 *
 * The base path is `/fhir` (no /v1 prefix on purpose — FHIR clients
 * expect the base URL plus the resource name). Auth is the same JWT
 * Bearer used everywhere else; we don't ship SMART-on-FHIR yet but the
 * Bearer flow is compatible with the simplest SMART pattern (Backend
 * Services / system-level access).
 */
@ApiTags('fhir')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin, Role.HospitalUser, Role.Radiologist)
@Controller({ path: 'fhir' })
export class FhirController {
  constructor(private readonly fhir: FhirService) {}

  @Get('Patient/:id')
  @Header('Content-Type', 'application/fhir+json')
  @ApiOperation({ summary: 'FHIR R4 Patient read' })
  getPatient(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.fhir.getPatient(user, id);
  }

  @Get('ImagingStudy')
  @Header('Content-Type', 'application/fhir+json')
  @ApiOperation({ summary: 'FHIR R4 ImagingStudy search' })
  searchImagingStudies(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patient') patient?: string,
    @Query('modality') modality?: string,
  ) {
    return this.fhir.searchImagingStudies(user, { patient, modality });
  }

  @Get('DiagnosticReport/:id')
  @Header('Content-Type', 'application/fhir+json')
  @ApiOperation({ summary: 'FHIR R4 DiagnosticReport read' })
  getDiagnosticReport(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.fhir.getDiagnosticReport(user, id);
  }

  @Get('DiagnosticReport')
  @Header('Content-Type', 'application/fhir+json')
  @ApiOperation({ summary: 'FHIR R4 DiagnosticReport search' })
  searchDiagnosticReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patient') patient?: string,
    @Query('status') status?: string,
  ) {
    return this.fhir.searchDiagnosticReports(user, { patient, status });
  }

  @Get('metadata')
  @Header('Content-Type', 'application/fhir+json')
  @ApiOperation({ summary: 'FHIR R4 CapabilityStatement' })
  capabilityStatement() {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          security: { service: [{ text: 'Bearer JWT' }] },
          resource: [
            { type: 'Patient', interaction: [{ code: 'read' }] },
            { type: 'ImagingStudy', interaction: [{ code: 'search-type' }] },
            {
              type: 'DiagnosticReport',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
            },
          ],
        },
      ],
    };
  }
}
