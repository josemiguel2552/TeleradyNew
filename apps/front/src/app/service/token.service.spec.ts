import { TestBed } from '@angular/core/testing';
import { TokenService } from './token.service';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import jwt_decode from 'jwt-decode';

jest.mock('jwt-decode', () => jest.fn());

const oAuthServiceMock = { signOut: jest.fn().mockResolvedValue(true) };

describe('TokenService (in-memory)', () => {
  let service: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: SocialAuthService, useValue: oAuthServiceMock }],
    });
    service = TestBed.inject(TokenService);
  });

  it('creates the service', () => {
    expect(service).toBeTruthy();
  });

  it('keeps the access token only in memory', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    (jwt_decode as jest.Mock).mockReturnValue({ exp: future, email: 'u@example.com' });

    service.setSession('the.access.token', 'u@example.com');

    expect(service.getRawToken()).toBe('the.access.token');
    expect(service.isAuthorized()).toBe(true);
    expect(service.getUserEmail()).toBe('u@example.com');
  });

  it('saveTokens accepts only the access token; refresh is ignored', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    (jwt_decode as jest.Mock).mockReturnValue({ exp: future });

    service.saveTokens('t', 'ignored-refresh');

    expect(service.getRawToken()).toBe('t');
    expect(service.getRefreshToken()).toBe('');
  });

  it('returns false on isAuthorized when no session is set', () => {
    expect(service.isAuthorized()).toBe(false);
  });

  it('returns false on isAuthorized when the access token is expired', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    (jwt_decode as jest.Mock).mockReturnValue({ exp: past });
    service.setSession('expired-token');
    expect(service.isAuthorized()).toBe(false);
  });

  it('clears the session on logout and signs out from OAuth', async () => {
    (jwt_decode as jest.Mock).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 60 });
    service.setSession('t');
    expect(service.isAuthorized()).toBe(true);

    service.logout();

    expect(service.getRawToken()).toBe('');
    expect(service.isAuthorized()).toBe(false);
    expect(oAuthServiceMock.signOut).toHaveBeenCalled();
  });

  it('returns empty strings for the deprecated refresh-token API', () => {
    expect(service.getRefreshToken()).toBe('');
    expect(service.decodeRefreshToken()).toBeNull();
    expect(service.isRefreshTokenExpired()).toBe(true);
  });
});
