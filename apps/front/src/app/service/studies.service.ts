import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { environment } from '../../environments/environment';
import { StudyResponse } from '../models/service/study-ap.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StudiesService {

  constructor(private http: HttpClient, private tokenService: TokenService) { }

  getStudies(params: any): Observable<StudyResponse> {
    return this.http.post<StudyResponse>(`${environment.apiActualPacs}/ris/es/api/ris/search/studies/`, params);
  }

  getViewerUrl(studyInstanceUID: string): string {
    return `${environment.apiActualPacs}/actualviewerv2/viewer/study/${studyInstanceUID}`;
  }
}
