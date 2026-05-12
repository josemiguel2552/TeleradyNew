import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TokenService } from './token.service';
import { environment } from '../../environments/environment';
import { AuthLogin, AuthRefresh, AuthSigup, PassRefresh } from '../models/service/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenServiceMock: any;

  beforeEach(() => {
    tokenServiceMock = {
      saveTokens: jest.fn()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: TokenService, useValue: tokenServiceMock }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const mockTokens = {
    accessToken: 'abc123',
    refreshToken: 'xyz789',
    newUser: false
  };

  const successResponse = {
    ok: true,
    message: 'Todo bien',
    response: mockTokens
  };

  const errorResponse = {
    ok: false,
    message: 'Algo salió mal'
  };

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call register and save tokens on success', () => {
    const data: AuthSigup = { email: 'test@example.com', password: '123456' };

    service.register(data).subscribe(res => {
      expect(res.ok).toBe(true);
      expect(tokenServiceMock.saveTokens).toHaveBeenCalledWith('abc123', 'xyz789');
    });

    const req = httpMock.expectOne(`${environment.apiURL}/auth/sigup`);
    expect(req.request.method).toBe('POST');
    req.flush(successResponse);
  });

  it('should return error on failed register', () => {
    const data: AuthSigup = { email: 'test@example.com', password: '123456' };

    service.register(data).subscribe(res => {
      expect(res.ok).toBe(false);
      expect(tokenServiceMock.saveTokens).not.toHaveBeenCalled();
    });

    const req = httpMock.expectOne(`${environment.apiURL}/auth/sigup`);
    req.flush(errorResponse, { status: 400, statusText: 'Bad Request' });
  });

  it('should login and save tokens on success', () => {
    const data: AuthLogin = { email: 'user@test.com', password: 'pass' };

    service.login(data).subscribe(res => {
      expect(res.ok).toBe(true);
      expect(tokenServiceMock.saveTokens).toHaveBeenCalled();
    });

    const req = httpMock.expectOne(`${environment.apiURL}/auth/login`);
    req.flush(successResponse);
  });

  it('should refresh tokens correctly', () => {
    const data: AuthRefresh = {email: 'user@test.com', refreshToken: 'xyz789' };

    service.refresh(data).subscribe(res => {
      expect(res.ok).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiURL}/auth/refresh`);
    req.flush(successResponse);
  });

  it('should handle userOauth and save tokens', () => {
    const data: AuthSigup = { email: 'oauth@test.com', password: 'oauth' };

    service.userOauth(data).subscribe(res => {
      expect(res.ok).toBe(true);
      expect(tokenServiceMock.saveTokens).toHaveBeenCalled();
    });

    const req = httpMock.expectOne(`${environment.apiURL}/auth/userOauth`);
    req.flush(successResponse);
  });

  it('should call recoverPass with GET', () => {
    const email = 'someone@test.com';

    service.recoverPass(email).subscribe(res => {
      expect(res.ok).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiURL}/auth/recoverPass/${email}`);
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
  });

  it('should call savePass with POST', () => {
    const data: PassRefresh = { token: 'token123', password: 'newpass' };

    service.savePass(data).subscribe(res => {
      expect(res.ok).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiURL}/auth/savePass`);
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
  });
});
