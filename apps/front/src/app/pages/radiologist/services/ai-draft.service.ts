import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AiDraftResult {
  text: string;
  latencyMs: number;
  charCount: number;
}

@Injectable({ providedIn: 'root' })
export class AiDraftService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiTelerady.replace(/\/v1$/, '')}/v2/reports`;

  generate(
    reportStudyId: string,
    payload: {
      findings: string;
      reportTitle: string;
      language?: 'es' | 'en';
      acceptConsent?: boolean;
    },
  ): Promise<AiDraftResult> {
    return firstValueFrom(
      this.http.post<AiDraftResult>(
        `${this.base}/${encodeURIComponent(reportStudyId)}/ai-draft`,
        payload,
      ),
    );
  }
}
