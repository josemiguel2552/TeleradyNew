import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../../service/auth.service';
import { TokenService } from '../../../../service/token.service';
import { PersonalDataService } from '../../../../service/personal-data.service';
import { MessageService } from 'primeng/api';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Base } from 'src/app/models/service/Base.model';
import { TokensLogin } from 'src/app/models/service/auth.model';

describe('LoginComponent (Jest)', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  const mockRouter = {
    navigateByUrl: jest.fn()
  };

  const mockMessageService = {
    add: jest.fn()
  };

  const mockTokenService = {
    isAuthorized: jest.fn(),
    saveTokens: jest.fn()
  };

  const mockAuthService = {
    login: jest.fn(),
    userOauth: jest.fn()
  };

  const mockPersonalDataService = {
    validate: jest.fn()
  };

  const mockSocialAuthService = {
    authState: of({
      email: 'oauth@test.com',
      firstName: 'OAuth',
      lastName: 'User',
      provider: 'GOOGLE'
    }),
    signIn: jest.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: PersonalDataService, useValue: mockPersonalDataService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: SocialAuthService, useValue: mockSocialAuthService },
        { provide: Router, useValue: mockRouter },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    localStorage.clear();
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should redirect if already authorized', () => {
    mockTokenService.isAuthorized.mockReturnValue(true);
    component.ngOnInit();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/offers');
  });

  it('should handle login success and redirect to dashboard', () => {
    const mockResponse: Base<TokensLogin> = {
      ok: true,
      message: 'Success',
      response: {
        accessToken: 'abc',
        refreshToken: 'def',
        newUser: false
      }
    };

    const mockValidate = {
      ok: true,
      response: { exists: true },
      message: 'Valid'
    };

    mockAuthService.login.mockReturnValue(of(mockResponse));
    mockPersonalDataService.validate.mockReturnValue(of(mockValidate));

    component.formGroup.setValue({ email: 'test@test.com', password: '123' });
    component.login();

    expect(mockTokenService.saveTokens).toHaveBeenCalled();
    expect(localStorage.getItem('userEmail')).toBe('test@test.com');
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/dashboard');
  });

  it('should redirect to personalData if user not exists', () => {
    const mockResponse: Base<TokensLogin> = {
      ok: true,
      message: 'Success',
      response: {
        accessToken: 'abc',
        refreshToken: 'def',
        newUser: false
      }
    };

    const mockValidate = {
      ok: true,
      response: { exists: false },
      message: 'No existe'
    };

    mockAuthService.login.mockReturnValue(of(mockResponse));
    mockPersonalDataService.validate.mockReturnValue(of(mockValidate));

    component.formGroup.setValue({ email: 'notfound@test.com', password: '123' });
    component.login();

    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/personalData');
  });

  it('should show warning on login error', () => {
    const mockResponse: Base<TokensLogin> = {
      ok: false,
      message: 'Invalid credentials',
      response: {
        accessToken: '',
        refreshToken: '',
        newUser: false
      }
    };

    mockAuthService.login.mockReturnValue(of(mockResponse));

    component.formGroup.setValue({ email: 'wrong@test.com', password: 'badpass' });
    component.login();

    expect(mockMessageService.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'warn',
      detail: mockResponse.message
    }));
  });

  it('should handle OAuth login and redirect accordingly', () => {
    const mockOAuthResponse: Base<TokensLogin> = {
      ok: true,
      message: 'OAuth Success',
      response: {
        accessToken: 'token',
        refreshToken: 'refresh',
        newUser: false
      }
    };

    mockAuthService.userOauth.mockReturnValue(of(mockOAuthResponse));
    mockPersonalDataService.validate.mockReturnValue(of({
      ok: true,
      response: { exists: true },
      message: 'valid'
    }));

    component.ngOnInit();

    expect(mockTokenService.saveTokens).toHaveBeenCalled();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/dashboard');
  });

  it('should call signIn on loginMicrosoft()', () => {
    component.loginMicrosoft();
    expect(localStorage.getItem('isOAuth')).toBe('true');
    expect(mockSocialAuthService.signIn).toHaveBeenCalled();
  });

  it('should return true if form control has error', () => {
    const control = component.formGroup.get('email');
    control?.markAsTouched();
    control?.setValue('');
    expect(component.showError('email')).toBe(true);
  });

  it('should return false if form control is valid', () => {
    const control = component.formGroup.get('email');
    control?.setValue('valid@email.com');
    expect(component.showError('email')).toBe(false);
  });
});
