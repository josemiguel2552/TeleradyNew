import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiDraftRequest {
  /** What the radiologist already wrote in their findings. */
  findings: string;
  /** Title / type of report the user picked in the UI. */
  reportTitle: string;
  /** Optional, defaults to RADIOGENAI_DEFAULT_LANGUAGE. */
  language?: 'es' | 'en';
}

export interface AiDraftResult {
  text: string;
  /** Milliseconds the upstream took to respond. */
  latencyMs: number;
  /** Body length in characters, useful for the metrics counter. */
  charCount: number;
}

export interface AiDraftStreamChunk {
  /** Plain text segment ready to append to the editor. */
  text: string;
}

export interface AiDraftStreamSummary {
  latencyMs: number;
  charCount: number;
}

/**
 * Thin wrapper around the RadiogenAI external API.
 *
 * Single point of contact for everything-AI in the platform: only the
 * AiDraftService should depend on this class. Authentication is the
 * `x-api-key` header agreed with the provider; rate limit and usage
 * accounting live on the RadiogenAI side, so all we do here is forward
 * the call with the right credentials and shape the response.
 *
 * Privacy contract — we MUST NOT pass any patient-identifying data to
 * the upstream:
 *   * No pat_id / pat_name / pat_birthdate.
 *   * No DICOM tags.
 *   * Only what the radiologist typed in the editor.
 * AiDraftService is responsible for enforcing that on the input side.
 */
@Injectable()
export class RadiogenAIClient {
  private readonly logger = new Logger(RadiogenAIClient.name);
  private readonly url: string | null;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;
  private readonly defaultLanguage: 'es' | 'en';

  constructor(config: ConfigService) {
    this.url = config.get<string>('RADIOGENAI_URL') ?? null;
    this.apiKey = config.get<string>('RADIOGENAI_API_KEY') ?? null;
    this.timeoutMs = config.get<number>('RADIOGENAI_TIMEOUT_MS') ?? 60_000;
    this.defaultLanguage = (config.get<'es' | 'en'>('RADIOGENAI_DEFAULT_LANGUAGE') ?? 'es') as
      | 'es'
      | 'en';
  }

  get configured(): boolean {
    return !!this.url && !!this.apiKey;
  }

  async generate(request: AiDraftRequest): Promise<AiDraftResult> {
    const started = Date.now();
    let text = '';
    for await (const chunk of this.iterChunks(request)) text += chunk.text;
    return {
      text: text.trim(),
      latencyMs: Date.now() - started,
      charCount: text.trim().length,
    };
  }

  /**
   * Streaming counterpart to `generate()` — yields each `data: …` line
   * the upstream emits as a `{ text }` chunk so the SPA can paint the
   * draft as it arrives. The summary is reported via the `onClose`
   * callback once the upstream finishes (so the orchestrator can write
   * the audit log entry with the final char count + latency).
   */
  async *generateStream(
    request: AiDraftRequest,
    onClose?: (summary: AiDraftStreamSummary) => void,
  ): AsyncGenerator<AiDraftStreamChunk, void, unknown> {
    const started = Date.now();
    let totalChars = 0;
    try {
      for await (const chunk of this.iterChunks(request)) {
        totalChars += chunk.text.length;
        yield chunk;
      }
    } finally {
      onClose?.({ latencyMs: Date.now() - started, charCount: totalChars });
    }
  }

  private async *iterChunks(
    request: AiDraftRequest,
  ): AsyncGenerator<AiDraftStreamChunk, void, unknown> {
    if (!this.configured) {
      throw new ServiceUnavailableException('AI integration not configured');
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.url!.replace(/\/$/, '')}/genreport`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
          'X-API-Key': this.apiKey!,
        },
        body: JSON.stringify({
          findings: request.findings,
          report_title: request.reportTitle,
          language: request.language ?? this.defaultLanguage,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new ServiceUnavailableException(
          `RadiogenAI upstream returned ${res.status}: ${detail.slice(0, 200)}`,
        );
      }
      if (!res.body) {
        const text = await res.text();
        if (text) yield { text };
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let pending = '';
      let firstEmitted = false;
      const emit = function* (line: string): Generator<AiDraftStreamChunk> {
        const cleaned = line.replace(/^data:\s?/, '');
        if (!cleaned) return;
        // Re-introduce the line break the producer placed between
        // chunks, except for the very first emission (avoids a
        // leading blank line in the editor).
        const text = firstEmitted ? `\n${cleaned}` : cleaned;
        firstEmitted = true;
        yield { text };
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let nl = pending.indexOf('\n');
        while (nl !== -1) {
          const rawLine = pending.slice(0, nl).replace(/\r$/, '');
          pending = pending.slice(nl + 1);
          for (const c of emit(rawLine)) yield c;
          nl = pending.indexOf('\n');
        }
      }
      pending += decoder.decode();
      if (pending.length > 0) {
        for (const c of emit(pending)) yield c;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ServiceUnavailableException(`RadiogenAI timed out after ${this.timeoutMs}ms`);
      }
      this.logger.warn(`RadiogenAI call failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(t);
    }
  }
}
