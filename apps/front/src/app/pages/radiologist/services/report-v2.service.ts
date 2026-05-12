import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ReportSection {
  key: string;
  title: string;
  body: string;
}

export interface ReportContents {
  modality: string;
  sections: ReportSection[];
  metadata?: Record<string, unknown>;
}

export type ReportState = 'draft' | 'finalized' | 'signed' | 'sent';

export interface ReportResponse {
  id: string;
  reportStudyId: string;
  state: ReportState;
  version: number;
  hospitalId: string | null;
  professionalId: string;
  contents: ReportContents | null;
  signature: Record<string, unknown> | null;
  signedAt: string | null;
  sentAt: string | null;
  pdfUrl: string | null;
}

export interface SignRequest {
  policy: 'name_collegiate' | 'drawn_hash_tsa';
  drawn?: { drawingBase64: string };
  displayedName?: string;
  collegiate?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportV2Service {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiTelerady.replace(/\/v1$/, '')}/v2/reports`;

  get(reportStudyId: string): Observable<ReportResponse> {
    return this.http.get<ReportResponse>(`${this.base}/${encodeURIComponent(reportStudyId)}`);
  }

  saveDraft(reportStudyId: string, contents: ReportContents): Promise<ReportResponse> {
    return firstValueFrom(
      this.http.put<ReportResponse>(`${this.base}/${encodeURIComponent(reportStudyId)}`, {
        contents,
      }),
    );
  }

  sign(reportStudyId: string, body: SignRequest): Promise<ReportResponse> {
    return firstValueFrom(
      this.http.post<ReportResponse>(
        `${this.base}/${encodeURIComponent(reportStudyId)}/sign`,
        body,
      ),
    );
  }

  send(reportStudyId: string): Promise<ReportResponse> {
    return firstValueFrom(
      this.http.post<ReportResponse>(
        `${this.base}/${encodeURIComponent(reportStudyId)}/send`,
        {},
      ),
    );
  }
}
