import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, map, Observable, of } from 'rxjs';
import { Base } from '../models/service/Base.model';
import { UploadDocumentPayload, DocumentType, UploadDocumentResult } from '../models/service/professional-document';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  constructor(private httpClient: HttpClient ) {}

  uploadDocument(payload: UploadDocumentPayload): Observable<Base<UploadDocumentResult>> {
    return this.httpClient.post<Base<UploadDocumentResult>>(`${environment.apiTelerady}/documents`,payload
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error al subir documento:', error);
        return of<Base<UploadDocumentResult>>(error.error);  
      })
    );
  }
  
  getUploadedDocuments(): Observable<Base<DocumentType[]>> {
    return this.httpClient.get<Base<DocumentType[]>>(`${environment.apiTelerady}/documents`)
    .pipe(
      catchError(error => {
        console.error("Error al obtener Documents:", error);
        return of<Base<DocumentType[]>>(error.error);  
      })
    );
  }

}
