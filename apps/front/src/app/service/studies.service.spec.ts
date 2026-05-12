import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StudiesService } from './studies.service';
import { TokenService } from './token.service';
import { StudyResponse } from '../models/service/study-ap.model';
import { environment } from '../../environments/environment';

describe('StudiesService', () => {
  let service: StudiesService;
  let httpMock: HttpTestingController;

  const mockTokenService = {
    getToken: jest.fn().mockReturnValue('mock-token')
  };

  const mockStudyResponse: StudyResponse = {
    studies: [
      {
        pat_id: '12345',
        study_desc: 'CT^Brain',
        last_serie_datetime: '2024-04-10T10:00:00Z',
        modalities: ['CT'],
        study_datetime: '',
        study_iuid: ''
      }
    ],
    total: 1
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        StudiesService,
        { provide: TokenService, useValue: mockTokenService }
      ]
    });
    service = TestBed.inject(StudiesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should make POST request to get studies and return expected data', () => {
    const mockParams = { page: 1, number: 25 };
    service.getStudies(mockParams).subscribe(response => {
      expect(response).toEqual(mockStudyResponse);
    });

    const req = httpMock.expectOne(`${environment.apiPacs}/studies/search`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockParams);
    req.flush(mockStudyResponse);
  });
});
