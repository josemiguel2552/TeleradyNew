import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { Role } from '../roles';
import { AuthService, type IssuedSession } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaSetupResponseDto, MfaTokenDto } from './dto/mfa.dto';
import { MfaService } from './mfa.service';
import { RegisterHospitalDto } from './dto/register-hospital.dto';
import {
  LoginResponseDto,
  RegisterHospitalResponseDto,
  UserSummaryDto,
} from './dto/auth-responses';
import type { AuthenticatedUser } from '../jwt.strategy';

const REFRESH_COOKIE = 'tr_refresh';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly cookieDomain: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';

  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    config: ConfigService,
  ) {
    this.cookieDomain = config.getOrThrow<string>('COOKIE_DOMAIN');
    this.cookieSecure = config.getOrThrow<boolean>('COOKIE_SECURE');
    this.cookieSameSite = config.getOrThrow<'lax' | 'strict' | 'none'>('COOKIE_SAMESITE');
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Authenticate a user and start a session' })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.auth.login(body, ctxOf(req));
    this.setRefreshCookie(res, session);
    return toLoginResponse(session);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Exchange a refresh cookie for a new access token' })
  @ApiOkResponse({ type: LoginResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (!presented) throw new UnauthorizedException('Missing refresh cookie');
    const session = await this.auth.refreshSession(presented, ctxOf(req));
    this.setRefreshCookie(res, session);
    return toLoginResponse(session);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const presented = req.cookies?.[REFRESH_COOKIE];
    await this.auth.logout(presented, user.id, ctxOf(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions(0));
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @Post('register-hospital')
  @ApiOperation({ summary: 'Admin: create a new hospital and its admin user' })
  @ApiCreatedResponse({ type: RegisterHospitalResponseDto })
  async registerHospital(
    @Body() body: RegisterHospitalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<RegisterHospitalResponseDto> {
    if (!user) throw new ForbiddenException();
    return this.auth.registerHospital(body, user.id, ctxOf(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user' })
  @ApiOkResponse({ type: UserSummaryDto })
  me(@CurrentUser() user: AuthenticatedUser): UserSummaryDto {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      hospitals: user.hospitalIds,
      professionalId: user.professionalId ?? null,
      mfaEnabled: false,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('mfa/setup')
  @ApiOperation({ summary: 'Generate a TOTP secret + QR for the current user' })
  @ApiOkResponse({ type: MfaSetupResponseDto })
  async mfaSetup(@CurrentUser() user: AuthenticatedUser): Promise<MfaSetupResponseDto> {
    const result = await this.mfa.setup(user.id, user.email);
    return { otpauthUrl: result.otpauthUrl, qrCodeDataUrl: result.qrCodeDataUrl };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('mfa/confirm')
  @HttpCode(204)
  @ApiOperation({ summary: 'Activate MFA by confirming the first TOTP code' })
  async mfaConfirm(
    @Body() body: MfaTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.mfa.confirm(user.id, body.token);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('mfa/disable')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disable MFA for the current user' })
  async mfaDisable(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.mfa.disable(user.id);
  }

  private setRefreshCookie(res: Response, session: IssuedSession): void {
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions(session.refreshMaxAgeMs));
  }

  private cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      domain: this.cookieDomain,
      path: '/v1/auth',
      maxAge,
    };
  }
}

function ctxOf(req: Request): { ip?: string | null; ua?: string | null } {
  return {
    ip: (req.ip ?? null) || null,
    ua: req.headers['user-agent'] ?? null,
  };
}

function toLoginResponse(session: IssuedSession): LoginResponseDto {
  return {
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: {
      id: session.user.id,
      email: session.user.email,
      roles: session.user.roles,
      hospitals: session.user.hospitals,
      professionalId: session.user.professionalId,
      mfaEnabled: session.user.mfaEnabled,
    },
  };
}
