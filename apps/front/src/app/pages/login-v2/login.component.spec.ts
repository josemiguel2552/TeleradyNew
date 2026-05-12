import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { LoginV2Component } from './login.component';
import { AuthService } from '../../service/auth.service';
import { TokenService } from '../../service/token.service';

describe('LoginV2Component', () => {
  let fixture: ComponentFixture<LoginV2Component>;
  let component: LoginV2Component;
  let authMock: jest.Mocked<Pick<AuthService, 'login'>>;
  let tokenMock: jest.Mocked<Pick<TokenService, 'decodeToken'>>;
  let routerMock: { navigateByUrl: jest.Mock };

  beforeEach(async () => {
    authMock = { login: jest.fn() } as any;
    tokenMock = { decodeToken: jest.fn() } as any;
    routerMock = { navigateByUrl: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginV2Component],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: TokenService, useValue: tokenMock },
        { provide: Router, useValue: routerMock },
        { provide: MessageService, useValue: { add: jest.fn() } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginV2Component);
    component = fixture.componentInstance;
  });

  it('routes radiologists to /radiologist/worklist on successful login', async () => {
    const result$ = new Subject<any>();
    authMock.login.mockReturnValue(result$.asObservable());
    tokenMock.decodeToken.mockReturnValue({ roles: ['radiologist'] });

    component.email.set('pepa@telerady.test');
    component.password.set('RadDemo!2026');
    const promise = component.submit();
    result$.next({ ok: true, response: { accessToken: 't', refreshToken: '' } });
    result$.complete();
    await promise;

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/radiologist/worklist');
  });

  it('routes admins to /admin/sla', async () => {
    const result$ = new Subject<any>();
    authMock.login.mockReturnValue(result$.asObservable());
    tokenMock.decodeToken.mockReturnValue({ roles: ['admin'] });

    component.email.set('admin@telerady.test');
    component.password.set('x');
    const promise = component.submit();
    result$.next({ ok: true, response: { accessToken: 't', refreshToken: '' } });
    result$.complete();
    await promise;

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/admin/sla');
  });

  it('surfaces the error message when login fails', async () => {
    const result$ = new Subject<any>();
    authMock.login.mockReturnValue(result$.asObservable());

    component.email.set('bad@x.es');
    component.password.set('wrong');
    const promise = component.submit();
    result$.next({ ok: false, message: 'Invalid credentials', response: { accessToken: '', refreshToken: '' } });
    result$.complete();
    await promise;

    expect(component.error()).toBe('Invalid credentials');
    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });
});
