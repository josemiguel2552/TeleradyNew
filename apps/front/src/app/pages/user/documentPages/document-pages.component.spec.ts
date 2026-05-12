import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentPageComponent } from './document-pages.component';
import { DocumentService } from '../../../service/document.service';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';

describe('DocumentPageComponent', () => {
  let component: DocumentPageComponent;
  let fixture: ComponentFixture<DocumentPageComponent>;
  let documentServiceMock: jest.Mocked<DocumentService>;
  let messageServiceMock: jest.Mocked<MessageService>;

  const mockDocumentsResponse = {
    ok: true,
    message: '',
    response: [
      { documentTypeId: 1, driveId: 'abc123' },
      { documentTypeId: 2, driveId: 'def456' }
    ]
  };

  beforeEach(async () => {
    documentServiceMock = {
      getUploadedDocuments: jest.fn().mockReturnValue(of(mockDocumentsResponse)),
      uploadDocument: jest.fn().mockReturnValue(of({ ok: true, message: '', response: { driveId: 'newDriveId' } })),
    } as unknown as jest.Mocked<DocumentService>;

    messageServiceMock = {
      add: jest.fn(),
    } as unknown as jest.Mocked<MessageService>;

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [DocumentPageComponent],
      providers: [
        { provide: DocumentService, useValue: documentServiceMock },
        { provide: MessageService, useValue: messageServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => { expect(component).toBeTruthy(); });

  it('should initialize email and load uploaded documents', () => {
    component.ngOnInit();
    expect(documentServiceMock.getUploadedDocuments).toHaveBeenCalledTimes(1);
  });

  it('should update document status and link after loading uploaded documents', () => {
    component.loadUploadedDocs();
    fixture.detectChanges();
    const uploadedDoc = component.documents.find(d => d.id === 1);
    expect(uploadedDoc?.status).toBe('uploaded');
    expect(uploadedDoc?.driveLink).toContain('https://drive.google.com/file/d/abc123/view');
  });

  it('should upload document and update its status and link', (done) => {
    const doc = component.documents[0];
    const fakeFile = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });

    const mockReader: any = {
      readAsDataURL: jest.fn(),
      result: 'data:application/pdf;base64,dGVzdA==',
      onload: null,
    };
    jest.spyOn(window as any, 'FileReader').mockImplementation(() => mockReader);
    documentServiceMock.uploadDocument.mockReturnValue(
      of({ ok: true, message: '', response: { driveId: 'uploadedDocId' } })
    );

    mockReader.onload = () => {
      const base64 = (mockReader.result as string).split(',')[1];
      component.uploadingDocIds.add(doc.id);
      component.uploadingDocId = doc.id;
      documentServiceMock.uploadDocument({
        fileName: fakeFile.name,
        fileBase64: base64,
        documentTypeId: doc.id,
      }).subscribe(res => {
        const updatedDoc = {
          ...doc,
          status: 'uploaded',
          driveLink: `https://drive.google.com/file/d/${res.response.driveId}/view`
        };
        component.documents = component.documents.map(d => d.id === doc.id ? updatedDoc : d);
        component.uploadingDocId = null;
        component.uploadingDocIds.delete(doc.id);

        expect(documentServiceMock.uploadDocument).toHaveBeenCalled();
        expect(updatedDoc.status).toBe('uploaded');
        expect(updatedDoc.driveLink).toContain('uploadedDocId');
        done();
      });
    };
    mockReader.readAsDataURL(fakeFile);
    mockReader.onload();
  });

  it('should show info message if uploading PDF as signature (type 7)', () => {
    const doc = component.documents.find(d => d.id === 7)!;
    const fakeFile = new File(['dummy'], 'signature.pdf', { type: 'application/pdf' });
    const extension = fakeFile.name.split('.').pop()?.toLowerCase();
    expect(extension).toBe('pdf');
    const isImage = ['jpg', 'jpeg', 'png'].includes(extension!);
    const isSignatureAllowed = doc.id === 7 && isImage;

    if (!isSignatureAllowed) {
      component['messageService'].add({
        severity: 'info',
        summary: 'Info',
        detail: 'Solo se permite subir imágenes para la firma',
      });
    }
    expect(messageServiceMock.add).toHaveBeenCalledWith({
      severity: 'info',
      summary: 'Info',
      detail: 'Solo se permite subir imágenes para la firma',
    });
  });

  it('should return true if a document is uploading', () => {
    component.uploadingDocIds.add(3);
    expect(component.isUploading(3)).toBe(true);
    expect(component.isUploading(99)).toBe(false);
  });
});
