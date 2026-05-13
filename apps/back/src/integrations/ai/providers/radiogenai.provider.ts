import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiDraftProvider,
  AiDraftRequest,
  AiDraftResult,
  AiDraftStreamChunk,
  AiDraftStreamSummary,
} from '../ai-draft.provider';

/**
 * Calls the external RadiogenAI service. Auth is the `x-api-key`
 * shared secret agreed with the provider. The upstream streams the
 * draft as `data: …` SSE lines; this implementation accumulates for
 * `generate()` and yields one chunk per line for `generateStream()`.
 *
 * Privacy: data leaves the perimeter. Operations must keep the art.
 * 28 RGPD contract on file.
 */
@Injectable()
export class RadiogenAIProvider implements AiDraftProvider {
  readonly providerName = 'radiogenai' as const;
  private readonly logger = new Logger(RadiogenAIProvider.name);
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
