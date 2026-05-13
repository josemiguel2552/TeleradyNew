import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export const MPPS_STATUSES = ['IN PROGRESS', 'COMPLETED', 'DISCONTINUED'] as const;
export type MppsStatus = (typeof MPPS_STATUSES)[number];

/**
 * MPPS event delivered by the modality (typically forwarded by an
 * Orthanc Lua script that parses the N-CREATE / N-SET payload).
 *
 * The shape mirrors the relevant DICOM tags 1:1 so the script doing
 * the forwarding stays trivial. Patient identifiers are NOT part of
 * the contract — MPPS gives us the accession number which is enough
 * to join with the MWL entry.
 */
export class MppsEventDto {
  @ApiProperty({
    description: 'DICOM PerformedProcedureStepID (0040,0253). Stable across N-CREATE / N-SET.',
  })
  @IsString()
  @Length(1, 64)
  performedProcedureStepId!: string;

  @ApiProperty({ enum: MPPS_STATUSES })
  @IsIn(MPPS_STATUSES as unknown as string[])
  status!: MppsStatus;

  @ApiProperty({
    required: false,
    description: 'AccessionNumber from the original MWL entry (joins MPPS to ORM/MWL).',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  accessionNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  studyInstanceUid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  modality?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  stationName?: string;

  @ApiProperty({ required: false, description: 'ISO 8601' })
  @IsOptional()
  @IsISO8601()
  startDateTime?: string;

  @ApiProperty({ required: false, description: 'ISO 8601 (only for status=COMPLETED|DISCONTINUED)' })
  @IsOptional()
  @IsISO8601()
  endDateTime?: string;
}

export class MppsEventResponseDto {
  @ApiProperty()
  eventId!: string;

  @ApiProperty({ description: '"new" if first time we see this PPS, "update" otherwise' })
  outcome!: 'new' | 'update';

  @ApiProperty({ nullable: true, description: 'mwl_entry.id matched by accession_number, null otherwise' })
  mwlEntryId!: string | null;

  @ApiProperty({ nullable: true, description: 'report_study.id matched by study_iuid, null otherwise' })
  reportStudyId!: string | null;
}
