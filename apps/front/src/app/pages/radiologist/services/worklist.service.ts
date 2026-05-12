import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface WorklistEntry {
  id: string;
  studyInstanceUid: string;
  studyDescription: string | null;
  studyCreatedAt: string | null;
  modalities: string[];
  institution: string | null;
  hospitalId: string | null;
  reportStateId: number;
  patName: string | null;
  patBirthdate: string | null;
  patIdHash: string | null;
}

export interface WorklistResponse {
  entries: WorklistEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorklistFilters {
  modality?: string;
  stateId?: number;
  studyDateFrom?: string;
  studyDateTo?: string;
  hospitalId?: string;
  offset?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class WorklistService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiTelerady}/worklist`;

  list(filters: WorklistFilters = {}): Observable<WorklistResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return this.http.get<WorklistResponse>(this.base, { params });
  }

  get(id: string): Promise<WorklistEntry> {
    return firstValueFrom(this.http.get<WorklistEntry>(`${this.base}/${encodeURIComponent(id)}`));
  }
}
