import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PersonalDataService } from './personal-data.service';
import { environment } from '../../environments/environment';
import { PersonalData } from '../models/service/personal-data.model';
import { Base } from '../models/service/Base.model';

describe('PersonalDataService', () => {
  let service: PersonalDataService;
  let httpMock: HttpTestingController;

  const mockPersonalData: PersonalData = {
    name: 'John',
    lastName: 'Doe',
    phone: '123456789',
    email: 'john@example.com',
    cityResidence: 'Madrid',
    titleStatusId: 1,
    professionalLicense: 'ABC123',
    subspecialties: [1, 2] // ✅ Correcto
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PersonalDataService]
    });

    service = TestBed.inject(PersonalDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should save personal data', () => {
    const mockResponse: Base<any> = {
      ok: true,
      message: 'Guardado',
      response: {}
    };

    service.savePersonalData(mockPersonalData).subscribe(response => {
      expect(response.ok).toBe(true);
      expect(response.message).toBe('Guardado');
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/personal-data`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should validate professional by email', () => {
    const mockValidationResponse: Base<{ exists: boolean }> = {
      ok: true,
      message: 'Validado',
      response: { exists: true }
    };

    const email = 'john@example.com';

    service.validate(email).subscribe(response => {
      expect(response.ok).toBe(true);
      expect(response.response?.exists).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/personal-data/validate?email=${email}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockValidationResponse);
  });

  it('should get subspecialties', () => {
    const mockSubspecialties = {
      ok: true,
      message: '',
      response: [
        { id: 1, name: 'Cardiología' },
        { id: 2, name: 'Neurología' }
      ]
    };

    service.getSubSpecialties().subscribe(response => {
      expect(response.ok).toBe(true);
      expect(response.response?.length).toBe(2);
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/parameters/subSpecialties`);
    expect(req.request.method).toBe('GET');
    req.flush(mockSubspecialties);
  });
});
