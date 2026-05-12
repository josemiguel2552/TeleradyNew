import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecoverPassComponent } from './recover-pass.component';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../../service/auth.service';
import { MessageService } from 'primeng/api';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import jwt_decode from 'jwt-decode';

jest.mock('jwt-decode', () => jest.fn());

describe('RecoverPassComponent', () => {
  let component: RecoverPassComponent;
  let fixture: ComponentFixture<RecoverPassComponent>;
  let authServiceMock: any;
  let messageServiceMock: any;
  let routerMock: any;

  beforeEach(() => {
    const activatedRouteStub = {
      snapshot: {
        paramMap: {
          get: () => 'mock.token.string'
        }
      }
    };

    authServiceMock = {
      savePass: jest.fn()
    };

    messageServiceMock = {
      add: jest.fn()
    };

    routerMock = {
      navigateByUrl: jest.fn()
    };

    (jwt_decode as jest.Mock).mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600, // token válido (1h adelante)
      isNormal: false,
      typeToken: 'pass'
    });

    TestBed.configureTestingModule({
      declarations: [RecoverPassComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: AuthService, useValue: authServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: Router, useValue: routerMock },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });

    fixture = TestBed.createComponent(RecoverPassComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate password confirmation mismatch', () => {
    component.formGroup.setValue({
      password: '123456',
      confirmPassword: '654321'
    });

    expect(component.formGroup.valid).toBeFalsy();
    expect(component.formGroup.errors).toEqual({ mustMatch: true });
  });

  it('should call savePass and navigate on success', () => {
    component.token = 'mock.token.string';
    component.formGroup.setValue({ password: 'test1234', confirmPassword: 'test1234' });

    authServiceMock.savePass.mockReturnValue(of({ ok: true, message: 'Contraseña actualizada' }));

    component.savePass();

    expect(authServiceMock.savePass).toHaveBeenCalledWith({
      password: 'test1234',
      token: 'mock.token.string'
    });

    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'success',
      summary: expect.any(String),
      detail: 'Contraseña actualizada'
    });

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/user/login');
  });
});
