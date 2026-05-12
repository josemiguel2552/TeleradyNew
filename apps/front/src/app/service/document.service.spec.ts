import { TestBed } from '@angular/core/testing';
import { DocumentService } from './document.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { UploadDocumentPayload, UploadDocumentResult, DocumentType } from '../models/service/professional-document';
import { Base } from '../models/service/Base.model';

describe('DocumentService', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DocumentService]
    });

    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const mockPayload: UploadDocumentPayload = {
    fileName: 'test.pdf',
    fileBase64: 'dGVzdA==',
    documentTypeId: 1,
  };

  const uploadResponse: Base<UploadDocumentResult> = {
    ok: true,
    message: 'Documento subido',
    response: { driveId: 'drive123' }
  };

  const getDocumentsResponse: Base<DocumentType[]> = {
    ok: true,
    message: 'Documentos obtenidos',
    response: [{ documentTypeId: 1, driveId: 'abc123' }]
  };

  it('should upload document successfully', () => {
    service.uploadDocument(mockPayload).subscribe(res => {
      expect(res).toEqual(uploadResponse);
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/documents`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockPayload);
    req.flush(uploadResponse);
  });

  it('should handle uploadDocument error and return fallback response', () => {
    service.uploadDocument(mockPayload).subscribe(res => {
      expect(res.ok).toBe(false);
      expect(res.response.driveId).toBe('');
      expect(res.message).toContain('Error inesperado');
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/documents`);
    req.flush('Internal Server Error', { status: 500, statusText: 'Server Error' });
  });

  it('should get uploaded documents by email', () => {
    service.getUploadedDocuments().subscribe(res => {
      expect(res.ok).toBe(true);
      expect(res.response.length).toBe(1);
      expect(res.response[0].driveId).toBe('abc123');
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/documents`);
    expect(req.request.method).toBe('GET');
    req.flush(getDocumentsResponse);
  });

  it('should handle getUploadedDocuments error and return fallback response', () => {
    service.getUploadedDocuments().subscribe(res => {
      expect(res.ok).toBe(false);
      expect(res.response).toEqual([]);
      expect(res.message).toContain('Error al obtener Documents');
    });

    const req = httpMock.expectOne(`${environment.apiTelerady}/documents`);
    req.flush('Error', { status: 500, statusText: 'Server Error' });
  });
});
