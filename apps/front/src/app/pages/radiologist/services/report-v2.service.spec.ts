import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportV2Service } from './report-v2.service';
import { environment } from '../../../../environments/environment';

const base = `${environment.apiTelerady.replace(/\/v1$/, '')}/v2/reports`;

describe('ReportV2Service', () => {
  let service: ReportV2Service;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportV2Service,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ReportV2Service);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs the report by study id', (done) => {
    service.get('study-1').subscribe((res) => {
      expect(res.id).toBe('r-1');
      done();
    });
    const req = http.expectOne(`${base}/study-1`);
    req.flush({ id: 'r-1', state: 'draft', version: 1, contents: null, signature: null });
  });

  it('PUTs the contents payload as autosave', async () => {
    const promise = service.saveDraft('study-1', {
      modality: 'CT',
      sections: [{ key: 'f', title: 'Findings', body: 'x' }],
    });
    const req = http.expectOne(`${base}/study-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      contents: {
        modality: 'CT',
        sections: [{ key: 'f', title: 'Findings', body: 'x' }],
      },
    });
    req.flush({ id: 'r-1', state: 'draft', version: 2 });
    await promise;
  });

  it('POSTs to /sign with the policy', async () => {
    const promise = service.sign('study-1', { policy: 'name_collegiate' });
    const req = http.expectOne(`${base}/study-1/sign`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ policy: 'name_collegiate' });
    req.flush({ id: 'r-1', state: 'signed', pdfUrl: 'https://signed' });
    await promise;
  });
});
