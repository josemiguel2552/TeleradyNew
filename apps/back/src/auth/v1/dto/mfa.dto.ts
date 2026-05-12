import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaTokenDto {
  @ApiProperty({ description: '6-digit TOTP code from the authenticator app' })
  @IsString()
  @Length(6, 8)
  token!: string;
}

export class MfaSetupResponseDto {
  @ApiProperty()
  otpauthUrl!: string;

  @ApiProperty({ description: 'Data URL (image/png) for the QR code' })
  qrCodeDataUrl!: string;
}
