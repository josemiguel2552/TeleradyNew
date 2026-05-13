import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import {
  CreatePushSubscriptionDto,
  PushPublicKeyResponseDto,
  PushSubscriptionResponseDto,
} from './dto/push-subscription.dto';
import { PushService } from './push.service';

@ApiTags('push')
@Controller({ path: 'push', version: '1' })
export class PushPublicController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  @ApiOperation({
    summary:
      'VAPID public key the SPA passes to PushManager.subscribe(). ' +
      'Public on purpose: the private key never leaves the back.',
  })
  @ApiOkResponse({ type: PushPublicKeyResponseDto })
  publicKey(): PushPublicKeyResponseDto {
    return { publicKey: this.push.getPublicKey() };
  }
}

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'me/push/subscriptions', version: '1' })
export class PushMeController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary:
      "Register the current device's push subscription. Idempotent: " +
      'same endpoint refreshes the keys / revokedAt instead of duplicating.',
  })
  @ApiOkResponse({ type: PushSubscriptionResponseDto })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePushSubscriptionDto,
  ): Promise<PushSubscriptionResponseDto> {
    return this.push.subscribe(user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke this device. Soft-delete: sets revoked_at.' })
  async unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.push.unsubscribe(user.id, id);
  }
}
