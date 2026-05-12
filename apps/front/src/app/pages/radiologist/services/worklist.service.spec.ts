import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { WorklistService } from './worklist.service';
import { environment } from '../../../../environments/environment';

describe('WorklistService', () => {
  let service: WorklistService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WorklistService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(WorklistService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('builds the query string from filters and parses the response', (done) => {
    service
      .list({ modality: 'CT', stateId: 1, offset: 25, limit: 50 })
      .subscribe((res) => {
        expect(res.total).toBe(1);
        expect(res.entries[0].id).toBe('rs-1');
        done();
      });

    const req = http.expectOne(
      `${environment.apiTelerady}/worklist?modality=CT&stateId=1&offset=25&limit=50`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      entries: [
        {
          id: 'rs-1',
          studyInstanceUid: '1.2.3',
          studyDescription: 'CT',
          studyCreatedAt: '2025-01-01T00:00:00Z',
          modalities: ['CT'],
          institution: 'X',
          hospitalId: 'h',
          reportStateId: 1,
          patName: 'María',
          patBirthdate: '1980-01-01',
          patIdHash: 'h1',
        },
      ],
      total: 1,
      limit: 50,
      offset: 25,
    });
  });

  it('skips empty filters', (done) => {
    service.list({ modality: '', stateId: undefined as any, limit: 10 }).subscribe(() => done());
    const req = http.expectOne(`${environment.apiTelerady}/worklist?limit=10`);
    req.flush({ entries: [], total: 0, limit: 10, offset: 0 });
  });
});
