import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SlaDashboard {
  counts: {
    draft: number;
    finalized: number;
    signed: number;
    sent: number;
    unreported: number;
  };
  avgMinutesToSign: number | null;
  avgMinutesSignToSent: number | null;
  pendingCount: number;
  overSlaCount: number;
  slaMinutes: number;
}

export interface AssignStudyResponse {
  reportStudyId: string;
  professionalId: string;
  reviewerProfessionalId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiTelerady}/admin`;

  sla(hospitalId?: string): Observable<SlaDashboard> {
    let url = `${this.base}/dashboard/sla`;
    if (hospitalId) url += `?hospitalId=${encodeURIComponent(hospitalId)}`;
    return this.http.get<SlaDashboard>(url);
  }

  assign(
    reportStudyId: string,
    professionalId: string,
    reviewerProfessionalId?: string,
  ): Promise<AssignStudyResponse> {
    return firstValueFrom(
      this.http.put<AssignStudyResponse>(
        `${this.base}/studies/${encodeURIComponent(reportStudyId)}/assign`,
        { professionalId, reviewerProfessionalId },
      ),
    );
  }
}
