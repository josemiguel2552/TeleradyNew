import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiDraftProvider,
  AiDraftRequest,
  AiDraftResult,
  AiDraftStreamChunk,
  AiDraftStreamSummary,
} from '../ai-draft.provider';

const SYSTEM_PROMPT_ES =
  'Eres un radiólogo redactando un informe formal. Solo respondes con el ' +
  'cuerpo del informe — sin saludos, sin disclaimers, sin metacomentarios. ' +
  'Mantén la estructura tradicional: TÉCNICA / HALLAZGOS / IMPRESIÓN.';
const SYSTEM_PROMPT_EN =
  'You are a radiologist drafting a formal report. Reply only with the body — ' +
  'no greetings, no disclaimers, no meta-comments. Keep the traditional ' +
  'structure: TECHNIQUE / FINDINGS / IMPRESSION.';

/**
 * Talks to a local Ollama runtime (or any other server exposing the
 * `/api/generate` NDJSON contract). Network traffic stays inside the
 * operator's perimeter, so RGPD art. 28 (data processor) does not
 * apply — the deploy becomes a single-party processing.
 *
 * Streaming: Ollama emits one JSON object per chunk, separated by `\n`:
 *   {"response":"frag", "done":false}
 *   ...
 *   {"response":"", "done":true, "total_duration": …}
 * We yield each non-empty `response` as a chunk.
 */
@Injectable()
export class OllamaProvider implements AiDraftProvider {
  readonly providerName = 'ollama' as const;
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly url: string | null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly defaultLanguage: 'es' | 'en';

  constructor(config: ConfigService) {
    this.url = config.get<string>('OLLAMA_URL') ?? null;
    this.model = config.get<string>('OLLAMA_MODEL') ?? 'llama3.1:8b-instruct';
    this.timeoutMs = config.get<number>('OLLAMA_TIMEOUT_MS') ?? 120_000;
    this.defaultLanguage = (config.get<'es' | 'en'>('RADIOGENAI_DEFAULT_LANGUAGE') ?? 'es') as
      | 'es'
      | 'en';
  }

  get configured(): boolean {
    return !!this.url;
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
    const language = request.language ?? this.defaultLanguage;
    const system = language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ES;
    const prompt =
      `${system}\n\n` +
      `Report title: ${request.reportTitle}\n` +
      `Existing findings (verbatim):\n${request.findings}\n\n` +
      `Produce the full report body now.`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.url!.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: true,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new ServiceUnavailableException(
          `Ollama upstream returned ${res.status}: ${detail.slice(0, 200)}`,
        );
      }
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let pending = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let nl = pending.indexOf('\n');
        while (nl !== -1) {
          const rawLine = pending.slice(0, nl).trim();
          pending = pending.slice(nl + 1);
          nl = pending.indexOf('\n');
          if (!rawLine) continue;
          const yielded = this.parseLine(rawLine);
          if (yielded !== null) yield { text: yielded };
        }
      }
      pending += decoder.decode();
      const tail = pending.trim();
      if (tail) {
        const yielded = this.parseLine(tail);
        if (yielded !== null) yield { text: yielded };
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ServiceUnavailableException(`Ollama timed out after ${this.timeoutMs}ms`);
      }
      this.logger.warn(`Ollama call failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  /** Parse one NDJSON line; return the text fragment or null if empty/done. */
  private parseLine(line: string): string | null {
    try {
      const obj = JSON.parse(line) as { response?: string; done?: boolean; error?: string };
      if (obj.error) throw new ServiceUnavailableException(`Ollama error: ${obj.error}`);
      const fragment = obj.response ?? '';
      if (!fragment) return null;
      return fragment;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      // Malformed line — skip silently rather than aborting the stream.
      this.logger.debug(`Skipping malformed Ollama line: ${line.slice(0, 80)}`);
      return null;
    }
  }
}
