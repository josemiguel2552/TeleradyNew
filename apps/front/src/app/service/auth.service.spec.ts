import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { environment } from '../../environments/environment';
import { AuthLogin } from '../models/service/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenServiceMock: any;

  const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
  const loginResponse = {
    accessToken,
    expiresIn: 900,
    user: {
      id: 'u-1',
      email: 'user@test.com',
      roles: ['radiologist'],
      hospitals: [],
      professionalId: null,
      mfaEnabled: false,
    },
  };

  beforeEach(() => {
    tokenServiceMock = {
      setSession: jest.fn(),
      clearSession: jest.fn(),
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: TokenService, useValue: tokenServiceMock },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('logs in against /v1/auth/login and stores the access token in memory', () => {
    const data: AuthLogin = { email: 'user@test.com', password: 'pass' };
    service.login(data).subscribe((res) => {
      expect(res.ok).toBe(true);
      expect(tokenServiceMock.setSession).toHaveBeenCalledWith(accessToken, 'user@test.com');
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(loginResponse);
  });

  it('refreshes via the httpOnly cookie endpoint', () => {
    service.refresh().subscribe((res) => {
      expect(res.ok).toBe(true);
      expect(tokenServiceMock.setSession).toHaveBeenCalledWith(accessToken, 'user@test.com');
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/auth/refresh`);
    expect(req.request.withCredentials).toBe(true);
    req.flush(loginResponse);
  });

  it('returns ok=false on a failed login without throwing', () => {
    service.login({ email: 'x@y.z', password: 'bad' } as AuthLogin).subscribe((res) => {
      expect(res.ok).toBe(false);
      expect(tokenServiceMock.setSession).not.toHaveBeenCalled();
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/auth/login`);
    req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('clears the session on logout', () => {
    service.logout().subscribe();
    const req = httpMock.expectOne(`${environment.apiTelerady}/auth/logout`);
    req.flush({});
    expect(tokenServiceMock.clearSession).toHaveBeenCalled();
  });
});
