import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

/**
 * Guards server-to-server endpoints (`/v1/integrations/*`). Reads the
 * shared secret from `INTEGRATION_API_KEY`; when the env is unset every
 * call responds 503 so a misconfigured deploy fails closed.
 *
 * The comparison uses `timingSafeEqual` to avoid timing oracles. Both
 * inputs are length-padded before comparing because the function
 * throws when buffer lengths differ.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTEGRATION_API_KEY');
    if (!expected) {
      throw new ServiceUnavailableException('Integration API key not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = (req.headers['x-api-key'] as string | undefined) ?? '';
    if (!provided) throw new UnauthorizedException('Missing x-api-key header');

    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    const max = Math.max(a.length, b.length);
    const aPadded = Buffer.concat([a, Buffer.alloc(max - a.length)]);
    const bPadded = Buffer.concat([b, Buffer.alloc(max - b.length)]);
    if (!timingSafeEqual(aPadded, bPadded) || a.length !== b.length) {
      throw new UnauthorizedException('Invalid x-api-key');
    }
    return true;
  }
}
