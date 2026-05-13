import {
  ServiceUnavailableException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

function ctxWithHeader(value: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: value === undefined ? {} : { 'x-api-key': value },
      }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(envValue: string | undefined): ApiKeyGuard {
  const config = { get: () => envValue } as unknown as ConfigService;
  return new ApiKeyGuard(config);
}

describe('ApiKeyGuard', () => {
  it('responds 503 when INTEGRATION_API_KEY is unset (fail closed)', () => {
    const guard = makeGuard(undefined);
    expect(() => guard.canActivate(ctxWithHeader('whatever'))).toThrow(ServiceUnavailableException);
  });

  it('rejects requests without the x-api-key header', () => {
    const guard = makeGuard('a'.repeat(40));
    expect(() => guard.canActivate(ctxWithHeader(undefined))).toThrow(UnauthorizedException);
  });

  it('rejects a wrong key', () => {
    const guard = makeGuard('a'.repeat(40));
    expect(() => guard.canActivate(ctxWithHeader('b'.repeat(40)))).toThrow(UnauthorizedException);
  });

  it('rejects a key whose length differs (early bail-out is still constant-time-equivalent)', () => {
    const guard = makeGuard('a'.repeat(40));
    expect(() => guard.canActivate(ctxWithHeader('a'.repeat(39)))).toThrow(UnauthorizedException);
  });

  it('accepts the exact expected key', () => {
    const guard = makeGuard('a'.repeat(40));
    expect(guard.canActivate(ctxWithHeader('a'.repeat(40)))).toBe(true);
  });
});
