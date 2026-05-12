import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StudiesService } from './studies.service';
import { TokenService } from './token.service';
import { environment } from '../../environments/environment';

describe('StudiesService', () => {
  let service: StudiesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        StudiesService,
        { provide: TokenService, useValue: { getToken: jest.fn() } },
      ],
    });
    service = TestBed.inject(StudiesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs to the PACS proxy and shapes the response into the legacy Study model', (done) => {
    service.getStudies({ modality: 'CT' }).subscribe((response) => {
      expect(response.total).toBe(1);
      expect(response.studies[0].study_iuid).toBe('1.2.3');
      expect(response.studies[0].study_desc).toBe('CT Brain');
      expect(response.studies[0].modalities).toEqual(['CT']);
      done();
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/pacs/studies/search`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ modality: 'CT' });
    req.flush([
      {
        studyInstanceUid: '1.2.3',
        studyDescription: 'CT Brain',
        studyDate: '20250101',
        modalities: ['CT'],
        accessionNumber: null,
        institution: 'Hospital X',
      },
    ]);
  });

  it('fetches the viewer URL from the backend', async () => {
    const promise = service.getViewerUrl('1.2.3');
    const req = httpMock.expectOne(`${environment.apiTelerady}/pacs/viewer/1.2.3`);
    expect(req.request.method).toBe('GET');
    req.flush({ url: 'https://ohif/viewer?StudyInstanceUIDs=1.2.3' });

    expect(await promise).toBe('https://ohif/viewer?StudyInstanceUIDs=1.2.3');
  });
});
