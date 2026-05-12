import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenService } from './token.service';
import { StudyResponse } from '../models/service/study.model';

/**
 * Studies catalogue.
 *
 * Sprint 2 will replace these endpoints with the DICOMweb proxy that the
 * backend exposes against Orthanc. Until then they target the in-house
 * `${apiPacs}` namespace so no third-party token is required.
 */
@Injectable({ providedIn: 'root' })
export class StudiesService {
  constructor(private http: HttpClient, private tokenService: TokenService) {}

  getStudies(params: any): Observable<StudyResponse> {
    return this.http.post<StudyResponse>(`${environment.apiPacs}/studies/search`, params);
  }

  getViewerUrl(studyInstanceUID: string): string {
    return `${environment.apiPacs}/viewer/${encodeURIComponent(studyInstanceUID)}`;
  }
}
