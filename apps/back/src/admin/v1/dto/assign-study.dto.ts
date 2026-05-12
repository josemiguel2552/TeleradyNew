import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignStudyDto {
  @ApiProperty({ description: 'Professional that takes the case', example: 'b1...' })
  @IsUUID()
  professionalId!: string;

  @ApiProperty({
    required: false,
    description: 'Optional second professional that will perform a verification read.',
  })
  @IsOptional()
  @IsUUID()
  reviewerProfessionalId?: string;
}

export class AssignStudyResponseDto {
  @ApiProperty() reportStudyId!: string;
  @ApiProperty() professionalId!: string;
  @ApiProperty({ nullable: true }) reviewerProfessionalId!: string | null;
}
