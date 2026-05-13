import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  auth!: string;
}

export class CreatePushSubscriptionDto {
  @ApiProperty({ description: 'Push service endpoint (FCM / Apple / Mozilla)' })
  @IsString()
  @MaxLength(500)
  endpoint!: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @IsObject()
  keys!: PushSubscriptionKeysDto;

  @ApiProperty({ required: false, description: 'navigator.userAgent at subscription time' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}

export class PushSubscriptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) userAgent!: string | null;
}

export class PushPublicKeyResponseDto {
  @ApiProperty({ description: 'VAPID public key, base64url-encoded' })
  publicKey!: string | null;
}
