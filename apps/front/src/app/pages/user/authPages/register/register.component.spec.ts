import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../../service/auth.service';
import { MessageService } from 'primeng/api';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Base } from 'src/app/models/service/Base.model';
import { TokensLogin } from 'src/app/models/service/auth.model';

describe('RegisterComponent (Jest)', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: AuthService;
  let messageService: MessageService;
  let router: Router;
  let oAuthService: SocialAuthService;

  const mockRouter = {
    navigateByUrl: jest.fn()
  };

  const mockMessageService = {
    add: jest.fn()
  };

  const mockAuthService = {
    register: jest.fn(),
    userOauth: jest.fn()
  };

  const mockSocialAuthService = {
    authState: of({
      email: 'test@gmail.com',
      firstName: 'Test',
      lastName: 'User',
      provider: 'GOOGLE'
    }),
    signIn: jest.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegisterComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: Router, useValue: mockRouter },
        { provide: SocialAuthService, useValue: mockSocialAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    messageService = TestBed.inject(MessageService);
    router = TestBed.inject(Router);
    oAuthService = TestBed.inject(SocialAuthService);

    localStorage.clear();
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should not call register if form is invalid', () => {
    component.formGroup.setValue({ email: '', password: '' });
    component.sigup();
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('should register user and navigate on success', () => {
    const mockResponse: Base<TokensLogin> = {
      ok: true,
      message: 'Registro correcto',
      response: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        newUser: true
      }
    };
    mockAuthService.register.mockReturnValue(of(mockResponse));
    component.formGroup.setValue({ email: 'user@test.com', password: '123456' });

    component.sigup();

    expect(mockAuthService.register).toHaveBeenCalled();
    expect(localStorage.getItem('userEmail')).toBe('user@test.com');
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/personalData');
    expect(mockMessageService.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'success',
      detail: mockResponse.message
    }));
  });

  it('should handle register error', () => {
    const mockResponse: Base<TokensLogin> = {
      ok: false,
      message: 'Ya existe',
      response: {
        accessToken: '',
        refreshToken: '',
        newUser: false
      }
    };
    mockAuthService.register.mockReturnValue(of(mockResponse));
    component.formGroup.setValue({ email: 'error@test.com', password: 'pass' });
  
    component.sigup();
  
    expect(mockMessageService.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      detail: mockResponse.message
    }));
  });
    it('should redirect via OAuth to /user/personalData if not newUser', () => {
    const oauthResponse: Base<TokensLogin> = {
      ok: true,
      message: 'Bienvenido',
      response: {
        accessToken: 'a',
        refreshToken: 'r',
        newUser: false
      }
    };
    mockAuthService.userOauth.mockReturnValue(of(oauthResponse));
    component.ngOnInit();

    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/personalData');
  });

  it('should redirect via OAuth to /user/personalData if newUser', () => {
    const oauthResponse: Base<TokensLogin> = {
      ok: true,
      message: 'Nuevo usuario',
      response: {
        accessToken: 'a',
        refreshToken: 'r',
        newUser: true
      }
    };
    mockAuthService.userOauth.mockReturnValue(of(oauthResponse));
    component.ngOnInit();

    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/personalData');
  });

  it('should set isOAuth and call signIn on registerMicrosoft()', () => {
    component.registerMicrosoft();

    expect(localStorage.getItem('isOAuth')).toBe('true');
    expect(mockSocialAuthService.signIn).toHaveBeenCalled();
  });

  it('should show error if control is invalid and touched', () => {
    const control = component.formGroup.get('email');
    control?.markAsTouched();
    control?.setValue('');
    expect(component.showError('email')).toBe(true);
  });

  it('should return false from showError for valid control', () => {
    component.formGroup.get('email')?.setValue('valid@email.com');
    expect(component.showError('email')).toBe(false);
  });
});
