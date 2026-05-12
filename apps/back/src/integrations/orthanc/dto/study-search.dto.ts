import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StudySearchDto {
  @ApiProperty({ required: false, example: 'CT' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  modality?: string;

  @ApiProperty({ required: false, example: '20240101' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  studyDateFrom?: string;

  @ApiProperty({ required: false, example: '20241231' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  studyDateTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accessionNumber?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class StudySearchResultDto {
  @ApiProperty()
  studyInstanceUid!: string;

  @ApiProperty({ nullable: true })
  studyDescription!: string | null;

  @ApiProperty({ nullable: true })
  studyDate!: string | null;

  @ApiProperty({ type: [String] })
  modalities!: string[];

  @ApiProperty({ nullable: true })
  accessionNumber!: string | null;

  @ApiProperty({ nullable: true })
  institution!: string | null;
}
