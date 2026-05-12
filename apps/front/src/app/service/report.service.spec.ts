import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReportService } from './report.service';
import { environment } from '../../environments/environment';

describe('ReportService', () => {
  let service: ReportService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReportService]
    });
    service = TestBed.inject(ReportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getReports', () => {
    it('should fetch reports with the correct language and headers', () => {
      const mockResponse = [{ id: 1, title: 'Report 1' }, { id: 2, title: 'Report 2' }];
      const language = navigator.language.startsWith('es') ? 'es' : 'en';
      const url = `${environment.apiUrlradiogenia}/reports/${language}`;

      service.getReports().subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('X-API-Key')).toBe('rdg_RFO17C4DEZTBCNPXG5H4ZPWIJW0S05VKWUYD0JIQ1hqh0c');

      req.flush(mockResponse);
    });
  });

  describe('generateReport', () => {
    it('should emit chunks from the stream and complete', (done) => {
      const findings = 'Some findings';
      const reportTitle = 'Test Report';
      const mockChunks = ['Chunk1\n', 'Chunk2\n', 'Chunk3'];
      const url = `${environment.apiUrlradiogenia}/genreport`;

      const mockFetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          body: {
            getReader: () => {
              let index = 0;
              return {
                read: () => {
                  if (index < mockChunks.length) {
                    return Promise.resolve({
                      done: false,
                      value: new TextEncoder().encode(mockChunks[index++])
                    });
                  } else {
                    return Promise.resolve({ done: true });
                  }
                }
              };
            }
          }
        } as Response) 
      );

      window.fetch = mockFetch;

      const expectedChunks = ['Chunk1', 'Chunk2', 'Chunk3'];
      let chunkIndex = 0;

      service.generateReport(findings, reportTitle).subscribe({
        next: (chunk) => {
          expect(chunk).toBe(expectedChunks[chunkIndex++]);
        },
        complete: () => {
          expect(chunkIndex).toBe(expectedChunks.length);
          done();
        },
        error: (err) => {
          done.fail(err);
        }
      });
    });

    it('should handle fetch errors', (done) => {
      const findings = 'Some findings';
      const reportTitle = 'Test Report';

      window.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      service.generateReport(findings, reportTitle).subscribe({
        next: () => done.fail('Should not emit any value'),
        complete: () => done.fail('Should not complete'),
        error: (err) => {
          expect(err.message).toBe('Network error');
          done();
        }
      });
    });
  });

  describe('getLangauge', () => {
    it('should return "es" if navigator language starts with "es"', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'es-ES',
        configurable: true
      });
      expect(service['getLangauge']()).toBe('es');
    });

    it('should return "en" if navigator language does not start with "es"', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true
      });
      expect(service['getLangauge']()).toBe('en');
    });
  });
});