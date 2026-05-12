import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenService } from './token.service';
import { StudyResponse, Study } from '../models/service/study.model';

interface StudySearchResultDto {
  studyInstanceUid: string;
  studyDescription: string | null;
  studyDate: string | null;
  modalities: string[];
  accessionNumber: string | null;
  institution: string | null;
}

/**
 * Studies catalogue: hits the backend PACS proxy at `/v1/pacs`. Orthanc is
 * never reached directly from the browser.
 */
@Injectable({ providedIn: 'root' })
export class StudiesService {
  private readonly base = environment.apiTelerady;

  constructor(private http: HttpClient, private tokenService: TokenService) {}

  getStudies(params: any): Observable<StudyResponse> {
    return this.http
      .post<StudySearchResultDto[]>(`${this.base}/pacs/studies/search`, params)
      .pipe(
        map((results) => ({
          studies: results.map<Study>((s) => ({
            study_iuid: s.studyInstanceUid,
            study_desc: s.studyDescription,
            study_created_time: s.studyDate ?? '',
            pat_name: null,
            pat_birthdate: null,
            sex: null,
            src_aet: null,
            institution: s.institution ?? '',
            modalities: s.modalities,
          })),
          total: results.length,
        })),
      );
  }

  /**
   * Returns the OHIF viewer URL for a given study. The backend builds it from
   * the OHIF_URL env var so the SPA stays free of hard-coded viewer hosts.
   */
  async getViewerUrl(studyInstanceUid: string): Promise<string> {
    const response = await firstValueFrom(
      this.http.get<{ url: string }>(
        `${this.base}/pacs/viewer/${encodeURIComponent(studyInstanceUid)}`,
      ),
    );
    return response.url;
  }
}
