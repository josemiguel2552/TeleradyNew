import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TokenInterceptor } from './token.interceptor';
import { AuthService } from '../service/auth.service';
import { TokenService } from '../service/token.service';
import { Router } from '@angular/router';

describe('TokenInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let tokenServiceMock: Partial<TokenService>;
  let routerMock: Partial<Router>;

  beforeEach(() => {
    tokenServiceMock = {
      getToken: jest.fn().mockReturnValue('mocked-token'),
    };

    routerMock = {
      navigate: jest.fn(),
    };

    TestBed.configureTestingModule({
    imports: [],
    providers: [
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: Router, useValue: routerMock },
        AuthService,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: TokenInterceptor,
            multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
    ]
});

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the interceptor', () => {
    const interceptors = TestBed.inject(HTTP_INTERCEPTORS);
    const interceptor = interceptors.find((i) => i instanceof TokenInterceptor);
    expect(interceptor).toBeTruthy();
  });

});
