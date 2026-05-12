import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { TokenService } from '../../../service/token.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let mockTokenService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockTokenService = {
      isLoggedIn$: of(true),
      decodeToken: jest.fn(() => ({
        email: 'test@example.com',
        name: 'Test User',
        sessionType: 'GOOGLE',
        specialty: 'Radiology',
        user_role: 'admin',
        isNormal: true,
        hasPhoto: true
      })),
      logout: jest.fn()
    };

    mockRouter = {
      navigateByUrl: jest.fn()
    };

    await TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should set isUserLoggedIn to true and populate user info', () => {
    component.ngOnInit();
    expect(component.isUserLoggedIn).toBe(true);
    expect(component.infoUser.email).toBe('test@example.com');
    expect(component.showImg).toBe(true);
  });

  it('should call logout and navigate to login page', () => {
    component.logout();
    expect(mockTokenService.logout).toHaveBeenCalled();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/user/login');
  });

  it('should detect mobile screen size correctly', () => {
    window.innerWidth = 500;
    component.onResize(null);
    expect(component.isMobile).toBe(true);
  });

  it('should activate the correct menu element', () => {
    component.setElement(2);
    expect(component.elementActive).toBe(2);
  });

  it('should unsubscribe from all subscriptions on destroy', () => {
    const subMock = { unsubscribe: jest.fn() };
    component['sub'] = subMock as any;
    component['subMenu'] = subMock as any;
    component['newMessageSubscription'] = subMock as any;
    component['readMessageSubscription'] = subMock as any;

    component.ngOnDestroy();
    expect(subMock.unsubscribe).toHaveBeenCalledTimes(4);
  });
});
