import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorklistQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  modality?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  stateId?: number;

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
  @IsUUID()
  hospitalId?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;
}

export class WorklistEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() studyInstanceUid!: string;
  @ApiProperty({ nullable: true }) studyDescription!: string | null;
  @ApiProperty({ nullable: true }) studyCreatedAt!: string | null;
  @ApiProperty({ type: [String] }) modalities!: string[];
  @ApiProperty({ nullable: true }) institution!: string | null;
  @ApiProperty({ nullable: true }) hospitalId!: string | null;
  @ApiProperty() reportStateId!: number;
  @ApiProperty() patName!: string | null;
  @ApiProperty() patBirthdate!: string | null;
  @ApiProperty({ description: 'HMAC of pat_id (deterministic, not reversible)' }) patIdHash!: string | null;
}

export class WorklistResponseDto {
  @ApiProperty({ type: [WorklistEntryDto] })
  entries!: WorklistEntryDto[];

  @ApiProperty() total!: number;

  @ApiProperty() limit!: number;

  @ApiProperty() offset!: number;
}
