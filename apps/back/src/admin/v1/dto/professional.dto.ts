import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProfessionalQueryDto {
  @ApiProperty({ required: false, description: 'Free-text search over name/lastName/email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiProperty({ required: false, default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;
}

export class ProfessionalSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true }) professionalLicense!: string | null;
}

export class ProfessionalListDto {
  @ApiProperty({ type: [ProfessionalSummaryDto] }) entries!: ProfessionalSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}
