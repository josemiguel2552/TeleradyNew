import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthRepository } from './v1/auth.repository';
import { JwtStrategy } from './jwt.strategy';
import { db } from '../database/drizzle';

jest.mock('../database/drizzle', () => ({ db: {} }));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authRepositoryMock: Partial<AuthRepository>;

  beforeEach(async () => {
    authRepositoryMock = { findUserById: jest.fn() };

    const config = {
      getOrThrow: (key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'a'.repeat(64),
          JWT_ISSUER: 'telerady',
          JWT_AUDIENCE: 'telerady-api',
        };
        const value = values[key];
        if (!value) throw new Error(`missing ${key}`);
        return value;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AuthRepository, useValue: authRepositoryMock },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    expect(strategy).toBeDefined();
  });

  it('returns the authenticated user when the payload is valid', async () => {
    const payload = {
      sub: 'user-id',
      email: 'test@example.com',
      roles: ['radiologist'],
      hospitalIds: ['h-1', 'h-2'],
      professionalId: 'p-1',
    };
    (authRepositoryMock.findUserById as jest.Mock).mockResolvedValueOnce({
      id: 'user-id',
      email: 'test@example.com',
    });

    const result = await strategy.validate(payload);

    expect(authRepositoryMock.findUserById).toHaveBeenCalledWith(db, 'user-id');
    expect(result).toEqual({
      id: 'user-id',
      email: 'test@example.com',
      roles: ['radiologist'],
      hospitalIds: ['h-1', 'h-2'],
      hospitalId: 'h-1',
      professionalId: 'p-1',
    });
  });

  it('throws when the payload is missing required claims', async () => {
    await expect(
      strategy.validate({ sub: '', email: '', roles: [] } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when the user no longer exists', async () => {
    (authRepositoryMock.findUserById as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'test@example.com',
        roles: [],
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when the email in the token no longer matches the user record', async () => {
    (authRepositoryMock.findUserById as jest.Mock).mockResolvedValueOnce({
      id: 'user-id',
      email: 'someone-else@example.com',
    });
    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'test@example.com',
        roles: [],
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
