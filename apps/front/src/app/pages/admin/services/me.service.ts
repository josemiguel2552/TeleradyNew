import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiTelerady}/me`;

  /**
   * Triggers the download of the personal data export. The backend returns
   * the JSON with a Content-Disposition: attachment header so the browser
   * saves it to disk.
   */
  async downloadExport(): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${this.base}/data-export`, { responseType: 'blob' }),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telerady-data-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  deleteAccount(): Promise<{ deletedAt: string }> {
    return firstValueFrom(this.http.delete<{ deletedAt: string }>(this.base));
  }
}
