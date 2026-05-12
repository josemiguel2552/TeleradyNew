import { TestBed } from '@angular/core/testing';
import { TokenService } from './token.service';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import jwt_decode from 'jwt-decode';

jest.mock('jwt-decode', () => jest.fn());

const oAuthServiceMock = {
  signOut: jest.fn().mockResolvedValue(true)
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        { provide: SocialAuthService, useValue: oAuthServiceMock }
      ]
    });

    service = TestBed.inject(TokenService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit true after saving tokens', () => {
    const loggedSpy = jest.spyOn(service['loggedIn'], 'next');
    service.saveTokens('token123', 'refresh456');
    expect(localStorage.getItem('TokenBH')).toContain('Bearer');
    expect(localStorage.getItem('RefreshTokenBH')).toBe('refresh456');
    expect(loggedSpy).toHaveBeenCalledWith(true);
  });

  it('should get token and refresh token from localStorage', () => {
    localStorage.setItem('TokenBH', 'Bearer token');
    localStorage.setItem('RefreshTokenBH', 'refresh');

    expect(service.getToken()).toBe('Bearer token');
    expect(service.getRefreshToken()).toBe('refresh');
  });

  it('should decode token if available', () => {
    (jwt_decode as jest.Mock).mockReturnValue({ userId: 'abc' });
    localStorage.setItem('TokenBH', 'Bearer test-token');

    const decoded = service.decodeToken();
    expect(decoded).toEqual({ userId: 'abc' });
  });

  it('should return null if no token for decodeToken', () => {
    const result = service.decodeToken();
    expect(result).toBeNull();
  });

  it('should return false if no token or expired in isAuthorized', () => {
    localStorage.removeItem('TokenBH');
    expect(service.isAuthorized()).toBe(false);
  });

  it('should return true in isAuthorized if token is valid', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // +1h
    (jwt_decode as jest.Mock).mockReturnValue({ exp: futureTime });
    localStorage.setItem('TokenBH', 'Bearer valid-token');

    expect(service.isAuthorized()).toBe(true);
  });

  it('should return false in isAuthorized if token expired', () => {
    const pastTime = Math.floor(Date.now() / 1000) - 3600; // -1h
    (jwt_decode as jest.Mock).mockReturnValue({ exp: pastTime });
    localStorage.setItem('TokenBH', 'Bearer expired-token');

    expect(service.isAuthorized()).toBe(false);
    expect(localStorage.getItem('TokenBH')).toBeNull(); // Token eliminado
  });

  it('should return true if refresh token is expired', () => {
    (jwt_decode as jest.Mock).mockReturnValue({ exp: 1000 }); // tiempo pasado
    localStorage.setItem('RefreshTokenBH', 'expired-refresh');
    expect(service.isRefreshTokenExpired()).toBe(true);
  });

  it('should return false if refresh token is still valid', () => {
    const future = Math.floor(Date.now() / 1000) + 10000;
    (jwt_decode as jest.Mock).mockReturnValue({ exp: future });
    localStorage.setItem('RefreshTokenBH', 'valid-refresh');
    expect(service.isRefreshTokenExpired()).toBe(false);
  });

  it('should clear storage and emit logout state on logout()', async () => {
    localStorage.setItem('TokenBH', 'Bearer token');
    const loggedSpy = jest.spyOn(service['loggedIn'], 'next');

    await service.logout();

    expect(localStorage.getItem('TokenBH')).toBeNull();
    expect(loggedSpy).toHaveBeenCalledWith(false);
    expect(oAuthServiceMock.signOut).toHaveBeenCalled();
  });

  it('should decode refresh token', () => {
    (jwt_decode as jest.Mock).mockReturnValue({ exp: 9999 });
    localStorage.setItem('RefreshTokenBH', 'refresh');
    const result = service.decodeRefreshToken();
    expect(result).toEqual({ exp: 9999 });
  });

  it('should return null from decodeRefreshToken if no token', () => {
    expect(service.decodeRefreshToken()).toBeNull();
  });
});
