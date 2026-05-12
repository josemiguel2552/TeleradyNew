import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AssignmentRuleDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  hospitalId?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'CT' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  modality?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  subspecialtyId?: number | null;

  @ApiProperty()
  @IsUUID()
  targetProfessionalId!: string;

  @ApiProperty({ default: 100 })
  @IsInt()
  @Min(0)
  priority: number = 100;

  @ApiProperty({ default: false })
  @IsBoolean()
  requiresReview: boolean = false;

  @ApiProperty({ default: true })
  @IsBoolean()
  active: boolean = true;
}

export class AssignmentRuleResponseDto extends AssignmentRuleDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
}
