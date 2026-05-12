import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PersonalDataComponent } from './personal-data.component';
import { MessageService } from 'primeng/api';
import { PersonalDataService } from '../../../../service/personal-data.service';
import { ParametersService } from '../../../../service/parameters.service';
import { t } from '../../../../shared/i18n/i18n';

describe('PersonalDataComponent', () => {
  let component: PersonalDataComponent;
  let fixture: ComponentFixture<PersonalDataComponent>;
  let messageServiceMock: any;
  let personalDataServiceMock: any;
  let parametersServiceMock: any;
  let routerMock: any;

  beforeEach(async () => {
    messageServiceMock = { add: jest.fn() };
    personalDataServiceMock = {
      getSubSpecialties: jest.fn().mockReturnValue(of({ ok: true, response: [] })),
      savePersonalData: jest.fn()
    };
    parametersServiceMock = {
      getGetTitleSpecialty: jest.fn().mockReturnValue(of({ ok: true, response: [] }))
    };
    routerMock = { navigateByUrl: jest.fn() };

    await TestBed.configureTestingModule({
      declarations: [PersonalDataComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MessageService, useValue: messageServiceMock },
        { provide: PersonalDataService, useValue: personalDataServiceMock },
        { provide: ParametersService, useValue: parametersServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load specialties on init', () => {
    const subSpy = jest.spyOn(personalDataServiceMock, 'getSubSpecialties');
    const titleSpy = jest.spyOn(parametersServiceMock, 'getGetTitleSpecialty');
    component.ngOnInit();
    expect(subSpy).toHaveBeenCalled();
    expect(titleSpy).toHaveBeenCalled();
  });

  it('should show warning if form is invalid', () => {
    component.register();
    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'warn',
      summary:  t('personalData.message.summarywarn'),
      detail: t('personalData.message.detail1'),
    });
  });

  it('should show error if titleStatusId is invalid', () => {
    component.formGroup.setValue({
      name: 'Ana',
      lastName: 'Gómez',
      phone: '123456789',
      email: 'ana@test.com',
      cityResidence: 'Madrid',
      professionalLicense: 'ABCD1234',
      titleStatusId: '', 
      subspecialties: ['1'] 
    });
  
    component.formGroup.controls['subspecialties'].setErrors(null);
    component.formGroup.controls['titleStatusId'].setErrors(null);
    component.formGroup.markAllAsTouched();
    component.formGroup.updateValueAndValidity();
    expect(component.formGroup.valid).toBe(true);
    component.register();
  
    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Error',
      detail: t('personalData.message.detail2'),
    });
  });
    
  it('should call savePersonalData and navigate on success', () => {
    component.formGroup.patchValue({
      name: 'Juan',
      lastName: 'Pérez',
      phone: '123456',
      email: 'juan@example.com',
      cityResidence: 'CDMX',
      professionalLicense: 'ABC123',
      titleStatusId: '1',
      subspecialties: ['1', '2']
    });

    const mockResponse = { ok: true, message: 'Éxito' };
    personalDataServiceMock.savePersonalData.mockReturnValue(of(mockResponse));

    component.register();

    expect(personalDataServiceMock.savePersonalData).toHaveBeenCalled();
    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'success',
      summary:  t('personalData.message.summarysuccess'),
      detail: mockResponse.message
    });
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/user/dashboard');
  });

  it('should show error if savePersonalData fails with message', () => {
    const error = { ok: false, message: 'Fallo en guardar' };
    personalDataServiceMock.savePersonalData.mockReturnValue(of(error));

    component.formGroup.patchValue({
      name: 'Juan',
      lastName: 'Pérez',
      phone: '123456',
      email: 'juan@example.com',
      cityResidence: 'CDMX',
      professionalLicense: 'ABC123',
      titleStatusId: '1',
      subspecialties: ['1']
    });

    component.register();

    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Error',
      detail: 'Fallo en guardar'
    });
  });
});
