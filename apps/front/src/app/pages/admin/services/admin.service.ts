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

export interface AuditEntry {
  id: string;
  ts: string;
  actorId: string | null;
  actorRole: string | null;
  hospitalId: string | null;
  action: string;
  targetKind: string;
  targetId: string | null;
  payload: unknown;
  prevHash: string | null;
  hash: string;
}

export interface AuditList {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditVerifyResult {
  ok: boolean;
  firstInvalidId: string | null;
  checkedRows: number;
}

export interface ProfessionalSummary {
  id: string;
  name: string;
  lastName: string;
  email: string;
  professionalLicense: string | null;
}

export interface ProfessionalList {
  entries: ProfessionalSummary[];
  total: number;
  limit: number;
  offset: number;
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

  listAudit(params: { offset?: number; limit?: number; action?: string }): Observable<AuditList> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') query.set(k, String(v));
    }
    const qs = query.toString();
    return this.http.get<AuditList>(`${this.base}/audit${qs ? `?${qs}` : ''}`);
  }

  verifyAudit(): Promise<AuditVerifyResult> {
    return firstValueFrom(this.http.post<AuditVerifyResult>(`${this.base}/audit/verify`, {}));
  }

  listProfessionals(q?: string): Observable<ProfessionalList> {
    const url = q ? `${this.base}/professionals?q=${encodeURIComponent(q)}` : `${this.base}/professionals`;
    return this.http.get<ProfessionalList>(url);
  }
}
