import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SaveReportDto {
  @ApiProperty({ description: 'DICOM StudyInstanceUID', example: '1.2.3.4.5' })
  @IsString()
  @MaxLength(150)
  studyId!: string;

  @ApiProperty({ example: 'TC de tórax sin contraste' })
  @IsString()
  @MaxLength(150)
  studyDesc!: string;

  @ApiProperty({ example: 'pat-123456' })
  @IsString()
  @MaxLength(150)
  patId!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MaxLength(150)
  patName!: string;

  @ApiProperty({ enum: ['M', 'F', 'O'] })
  @IsString()
  @IsIn(['M', 'F', 'O'])
  sex!: string;

  @ApiProperty({ example: '1985-04-23', description: 'ISO 8601 date' })
  @IsDateString()
  patBirthdate!: string;

  @ApiProperty({ type: [String], example: ['CT'] })
  @IsArray()
  @IsString({ each: true })
  modalities!: string[];

  @ApiProperty({ example: 'Hospital Universitario de Madrid' })
  @IsString()
  @MaxLength(150)
  institution!: string;

  @ApiProperty({ example: 'agent' })
  @IsString()
  @MaxLength(150)
  src!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  idReportState!: number;

  @ApiProperty({
    required: false,
    description: 'Optional explicit hospital scope. Required for users that belong to several hospitals.',
  })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
