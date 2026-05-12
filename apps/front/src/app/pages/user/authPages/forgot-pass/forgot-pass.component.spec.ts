import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPassComponent } from './forgot-pass.component';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../service/auth.service';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { Router } from '@angular/router';

describe('ForgotPassComponent', () => {
  let component: ForgotPassComponent;
  let fixture: ComponentFixture<ForgotPassComponent>;
  let authServiceMock: any;
  let messageServiceMock: any;
  let routerMock: any;

  beforeEach(async () => {
    authServiceMock = {
      recoverPass: jest.fn()
    };

    messageServiceMock = {
      add: jest.fn()
    };

    routerMock = {
      navigateByUrl: jest.fn()
    };

    await TestBed.configureTestingModule({
      declarations: [ForgotPassComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPassComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should mark form as touched and not call recoverPass if form is invalid', () => {
    const spy = jest.spyOn(authServiceMock, 'recoverPass');
    component.sendEmail();
    expect(spy).not.toHaveBeenCalled();
    expect(component.formGroup.touched).toBeTruthy();
  });

  it('should call recoverPass and navigate on success', () => {
    component.formGroup.setValue({ email: 'test@example.com' });
    const mockResponse = { ok: true, message: 'Success' };
    authServiceMock.recoverPass.mockReturnValue(of(mockResponse));

    component.sendEmail();

    expect(authServiceMock.recoverPass).toHaveBeenCalledWith('test@example.com');
    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'success',
      summary: expect.any(String),
      detail: 'Success'
    });
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/user/login');
  });

  it('should show warning if recoverPass returns error', () => {
    component.formGroup.setValue({ email: 'test@example.com' });
    const mockResponse = { ok: false, message: 'Email not found' };
    authServiceMock.recoverPass.mockReturnValue(of(mockResponse));

    component.sendEmail();

    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'warn',
      summary: expect.any(String),
      detail: 'Email not found'
    });
    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should return true for showError when control is invalid and touched', () => {
    const control = component.formGroup.get('email');
    control?.markAsTouched();
    control?.setValue('');
    expect(component.showError('email')).toBe(true);
  });

  it('should return false for showError when control is valid', () => {
    const control = component.formGroup.get('email');
    control?.setValue('test@example.com');
    control?.markAsTouched();
    expect(component.showError('email')).toBe(false);
  });
});
