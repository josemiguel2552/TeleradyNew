import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardPagesComponent } from './dashboard-pages.component';
import { TokenService } from '../../../service/token.service';
import { of } from 'rxjs';

describe('DashboardPagesComponent', () => {
  let component: DashboardPagesComponent;
  let fixture: ComponentFixture<DashboardPagesComponent>;
  let tokenServiceMock: any;

  beforeEach(async () => {
    tokenServiceMock = {
      decodeToken: jest.fn().mockReturnValue({
        email: 'test@example.com',
        name: 'Test User',
        specialty: 'Cardiology'
      })
    };

    await TestBed.configureTestingModule({
      declarations: [DashboardPagesComponent],
      providers: [
        { provide: TokenService, useValue: tokenServiceMock }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DashboardPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set isMobile based on window width', () => {
    expect(component.isMobile).toBe(window.innerWidth < 768);
  });

  it('should update isMobile on window resize', () => {
    window.innerWidth = 500;
    window.dispatchEvent(new Event('resize'));
    expect(component.isMobile).toBe(true);

    window.innerWidth = 800;
    window.dispatchEvent(new Event('resize'));
    expect(component.isMobile).toBe(false);
  });

  it('should get user info on init', () => {
    component.ngOnInit();
    expect(component.infoUser.email).toBe('test@example.com');
    expect(component.infoUser.name).toBe('Test User');
    expect(component.infoUser.specialty).toBe('Cardiology');
  });

  it('should handle missing user info gracefully', () => {
    tokenServiceMock.decodeToken.mockReturnValue({});
    component.ngOnInit();
    expect(component.infoUser.email).toBeNull();
    expect(component.infoUser.name).toBeNull();
    expect(component.infoUser.specialty).toBeNull();
  });
});