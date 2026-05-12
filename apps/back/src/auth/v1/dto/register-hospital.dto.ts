import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { hospitalSignaturePolicy, type HospitalSignaturePolicy } from '../../../database/schema';

export class RegisterHospitalDto {
  @ApiProperty({ example: 'Hospital Clínico San Carlos' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false, example: 'A12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiProperty({
    enum: hospitalSignaturePolicy,
    default: 'name_collegiate',
  })
  @IsIn(hospitalSignaturePolicy as unknown as string[])
  signaturePolicy: HospitalSignaturePolicy = 'name_collegiate';

  @ApiProperty({ default: 3650, description: 'Days the platform keeps tenant data by default' })
  @IsInt()
  @Min(30)
  @Max(36500)
  retentionDays: number = 3650;

  @ApiProperty({ example: 'admin@hospital.es' })
  @IsEmail()
  @MaxLength(200)
  adminEmail!: string;

  @ApiProperty({ example: 'long random passphrase' })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  adminPassword!: string;
}
