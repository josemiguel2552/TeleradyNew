import { Component } from '@angular/core';
import { DocumentService } from '../../../service/document.service';
import { t } from '../../../shared/i18n/i18n';
import { MessageService } from 'primeng/api';
import { Base } from '../../../models/service/Base.model';
import { DocumentType, UploadDocumentResult } from '../../../models/service/professional-document';

@Component({
  selector: 'app-document-pages',
  standalone: false,
  templateUrl: './document-pages.component.html',
  styleUrls: ['./document-pages.component.scss'],
})
export class DocumentPageComponent {
  t = t;
  uploadingDocId: number | null = null;
  uploadingDocIds: Set<number> = new Set();

  documents = [
    { id: 1, name: t('document.names.specialistTitle'), status: 'pending', driveLink: '' },
    { id: 2, name: t('document.names.professionalAssociation'), status: 'pending', driveLink: '' },
    { id: 3, name: t('document.names.selfEmployment'), status: 'pending', driveLink: '' },
    { id: 4, name: t('document.names.idCard'), status: 'pending', driveLink: '' },
    { id: 5, name: t('document.names.liabilityInsurance'), status: 'pending', driveLink: '' },
    { id: 6, name: t('document.names.bankCertificate'), status: 'pending', driveLink: '' },
    { id: 7, name: t('document.names.signature'), status: 'pending', driveLink: '' },
  ];

  constructor(private documentService: DocumentService, private messageService: MessageService) { }

  ngOnInit(): void {
    this.loadUploadedDocs();
  }

  loadUploadedDocs() {
    this.documentService.getUploadedDocuments().subscribe({
      next: (res: Base<DocumentType[]>) => {
        if (res.ok) {
          const uploadedDocs = res.response || [];
          this.documents = this.documents.map(doc => {
            const match = uploadedDocs.find(d => +d.documentTypeId === +doc.id);
            if (match) {
              return { ...doc, status: 'uploaded', driveLink: `https://drive.google.com/file/d/${match.driveId}/view` };
            }
            return doc;
          });
        }
        else
          this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message });
      }
    });
  }

  handleAction(doc: any) {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf, .jpg, .jpeg, .png';

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png'].includes(extension || '');
        const isPdfAllowed = extension === 'pdf';
        if (doc.id === 7 && !isImage) {
          this.messageService.add({ severity: 'info', summary: 'Info', detail: t('document.error.signatureError') });
          return;
        }
        if (doc.id !== 7 && !isPdfAllowed) {
          this.messageService.add({ severity: 'info', summary: 'Error', detail: t('document.error.documentError') });
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          this.uploadingDocIds.add(doc.id);
          this.uploadingDocId = doc.id;
          this.documentService.uploadDocument({
            fileName: file.name,
            fileBase64: base64,
            documentTypeId: doc.id,
          }).subscribe({
            next: (res: Base<UploadDocumentResult>) => {
              if (res.ok) {
                this.documents = this.documents.map(d =>
                  d.id === doc.id ? {
                    ...d, status: 'uploaded', driveLink: `https://drive.google.com/file/d/${res.response.driveId}/view`
                  } : d
                );
              }
              else {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message });
              }
              this.uploadingDocId = null;
              this.uploadingDocIds.delete(doc.id);
            }
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  isUploading(docId: number): boolean {
    return this.uploadingDocIds.has(docId);
  }
}