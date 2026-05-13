import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../service/token.service';

export interface AiDraftResult {
  text: string;
  latencyMs: number;
  charCount: number;
}

export interface AiDraftStreamHandlers {
  onChunk: (text: string) => void;
  onError?: (err: { status: number; message: string }) => void;
  signal?: AbortSignal;
}

@Injectable({ providedIn: 'root' })
export class AiDraftService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
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

  /**
   * Streams the AI draft via SSE. Resolves once the upstream finishes
   * (`event: done`) or rejects when the gate fails / the connection
   * drops. We read with `fetch` because EventSource cannot send a body
   * and Angular's HttpClient does not expose the underlying reader.
   */
  async generateStream(
    reportStudyId: string,
    payload: {
      findings: string;
      reportTitle: string;
      language?: 'es' | 'en';
      acceptConsent?: boolean;
    },
    handlers: AiDraftStreamHandlers,
  ): Promise<void> {
    const token = this.tokens.getRawToken();
    const url = `${this.base}/${encodeURIComponent(reportStudyId)}/ai-draft/stream`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: handlers.signal,
    });
    if (!res.ok) {
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const err = new Error(body?.message ?? `Stream failed (${res.status})`);
      (err as any).status = res.status;
      throw err;
    }
    if (!res.body) throw new Error('Empty stream body');
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        this.processFrame(frame, handlers);
        sep = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.trim().length > 0) this.processFrame(buffer, handlers);
  }

  private processFrame(frame: string, handlers: AiDraftStreamHandlers): void {
    const lines = frame.split(/\r?\n/);
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^\s/, ''));
      }
    }
    const data = dataLines.join('\n');
    if (event === 'chunk') {
      handlers.onChunk(data);
    } else if (event === 'error' && handlers.onError) {
      try {
        handlers.onError(JSON.parse(data));
      } catch {
        handlers.onError({ status: 500, message: data });
      }
    }
    // 'done' carries `{}`; ignored — the loop terminates on its own.
  }
}
