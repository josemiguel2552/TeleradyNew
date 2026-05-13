import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { TokenInterceptor } from './token.interceptor';
import { AuthService } from '../service/auth.service';
import { TokenService } from '../service/token.service';
import { environment } from '../../environments/environment';

describe('TokenInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let tokenServiceMock: Partial<TokenService>;
  let authServiceMock: Partial<AuthService>;
  let routerMock: Partial<Router>;

  beforeEach(() => {
    tokenServiceMock = {
      getToken: jest.fn().mockReturnValue('access-token'),
      getRawToken: jest.fn().mockReturnValue('access-token'),
      clearSession: jest.fn(),
    };
    authServiceMock = {
      refresh: jest.fn(),
    };
    routerMock = { navigateByUrl: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: TokenInterceptor,
          multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => httpMock.verify());

  it('attaches the access token and withCredentials to own-API requests', () => {
    httpClient.get(`${environment.apiTelerady}/me`).subscribe();
    const req = httpMock.expectOne(`${environment.apiTelerady}/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('does not touch foreign requests', () => {
    httpClient.get('https://example.com/data').subscribe();
    const req = httpMock.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(false);
    req.flush({});
  });

  it('retries once after a 401 by refreshing the session', () => {
    (authServiceMock.refresh as jest.Mock).mockReturnValue(
      of({ ok: true, message: 'ok', response: { accessToken: 'new', refreshToken: '' } }),
    );

    httpClient.get(`${environment.apiTelerady}/studies`).subscribe();

    const first = httpMock.expectOne(`${environment.apiTelerady}/studies`);
    first.flush({}, { status: 401, statusText: 'Unauthorized' });

    const retry = httpMock.expectOne(`${environment.apiTelerady}/studies`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-token');
    retry.flush({});
    expect(authServiceMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('navigates to login when refresh also fails', () => {
    (authServiceMock.refresh as jest.Mock).mockReturnValue(
      of({ ok: false, message: 'no', response: { accessToken: '', refreshToken: '' } }),
    );

    httpClient.get(`${environment.apiTelerady}/studies`).subscribe({
      error: () => {
        /* swallowed for the test */
      },
    });

    const first = httpMock.expectOne(`${environment.apiTelerady}/studies`);
    first.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(tokenServiceMock.clearSession).toHaveBeenCalled();
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
