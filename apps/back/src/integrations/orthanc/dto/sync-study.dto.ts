import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SyncStudyDto {
  @ApiProperty({
    description: 'DICOM StudyInstanceUID of the study to ingest from Orthanc',
    example: '1.2.840.113619.2.55.3.604688119.971.1693501800.123',
  })
  @IsString()
  @MaxLength(150)
  studyInstanceUid!: string;

  @ApiProperty({
    required: false,
    description: 'Optional explicit hospital scope (required for multi-hospital users).',
  })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiProperty({
    required: false,
    description:
      'Optional professional override (admins/coordinators only). Defaults to the actor.',
  })
  @IsOptional()
  @IsUUID()
  professionalId?: string;
}

export class SyncStudyResponseDto {
  @ApiProperty()
  reportStudyId!: string;

  @ApiProperty()
  studyInstanceUid!: string;

  @ApiProperty({ description: '"created" or "updated"' })
  action!: 'created' | 'updated';

  @ApiProperty()
  hospitalId!: string | null;
}
