import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @ApiProperty({ description: 'true = approved, false = rejected (changes requested)' })
  @IsBoolean()
  approved!: boolean;

  @ApiProperty({ required: false, description: 'Optional reviewer comments stored in audit log' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}
