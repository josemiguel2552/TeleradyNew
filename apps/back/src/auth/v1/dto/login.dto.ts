import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@telerady.es' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ example: 'long random passphrase' })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @ApiProperty({ required: false, description: '6-digit TOTP code if MFA is enabled' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  totp?: string;
}
