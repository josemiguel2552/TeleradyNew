import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportSectionDto {
  @ApiProperty({ example: 'findings' })
  @IsString()
  @MaxLength(50)
  key!: string;

  @ApiProperty({ example: 'Findings' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ description: 'Plain-text body for the section' })
  @IsString()
  @MaxLength(20_000)
  body!: string;
}

export class ReportContentsDto {
  @ApiProperty({ enum: ['CT', 'MR', 'RX', 'US', 'OTHER'], example: 'CT' })
  @IsString()
  @MaxLength(20)
  modality!: string;

  @ApiProperty({ type: [ReportSectionDto] })
  @IsArray()
  sections!: ReportSectionDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SaveReportV2Dto {
  @ApiProperty({ type: () => ReportContentsDto })
  @IsObject()
  contents!: ReportContentsDto;
}
