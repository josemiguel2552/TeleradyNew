import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBase64,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { hospitalSignaturePolicy } from '../../../database/schema';

export class DrawnSignatureDto {
  @ApiProperty({ description: 'Base64-encoded PNG of the drawn signature' })
  @IsBase64()
  @MaxLength(2_000_000)
  drawingBase64!: string;
}

export class SignReportDto {
  @ApiProperty({ enum: hospitalSignaturePolicy })
  @IsIn(hospitalSignaturePolicy as unknown as string[])
  policy!: (typeof hospitalSignaturePolicy)[number];

  @ApiProperty({ required: false, type: () => DrawnSignatureDto })
  @ValidateIf((o) => o.policy === 'drawn_hash_tsa')
  @ValidateNested()
  @Type(() => DrawnSignatureDto)
  drawn?: DrawnSignatureDto;

  @ApiProperty({
    required: false,
    description: 'Override the displayed name (defaults to the professional record).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayedName?: string;

  @ApiProperty({
    required: false,
    description: 'Override the collegiate number (defaults to the professional record).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  collegiate?: string;
}
