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

interface OpenAiChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

/**
 * Talks to any server exposing the OpenAI Chat Completions API
 * (vLLM, TGI in compatibility mode, llama.cpp's `server`, …) on the
 * operator's own network. Same privacy guarantees as the Ollama
 * provider — nothing leaves the perimeter — but with a richer
 * deployment story (vLLM scales horizontally, supports paged
 * attention, can hold dozens of models per replica).
 *
 * Wire format: `POST /v1/chat/completions` with `stream: true`. The
 * upstream replies with SSE `data: {…}` frames; the final frame is
 * `data: [DONE]`. We yield each `choices[0].delta.content` as a
 * chunk.
 */
@Injectable()
export class VllmProvider implements AiDraftProvider {
  readonly providerName = 'vllm' as const;
  private readonly logger = new Logger(VllmProvider.name);
  private readonly url: string | null;
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly defaultLanguage: 'es' | 'en';

  constructor(config: ConfigService) {
    this.url = config.get<string>('VLLM_URL') ?? null;
    this.apiKey = config.get<string>('VLLM_API_KEY') ?? null;
    this.model = config.get<string>('VLLM_MODEL') ?? 'meta-llama/Meta-Llama-3.1-8B-Instruct';
    this.timeoutMs = config.get<number>('VLLM_TIMEOUT_MS') ?? 120_000;
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
    const userMsg =
      `Report title: ${request.reportTitle}\n` +
      `Existing findings (verbatim):\n${request.findings}\n\n` +
      `Produce the full report body now.`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.url!.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMsg },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new ServiceUnavailableException(
          `vLLM upstream returned ${res.status}: ${detail.slice(0, 200)}`,
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
          const rawLine = pending.slice(0, nl).replace(/\r$/, '').trim();
          pending = pending.slice(nl + 1);
          nl = pending.indexOf('\n');
          if (!rawLine || !rawLine.startsWith('data:')) continue;
          const payload = rawLine.slice(5).trim();
          if (payload === '[DONE]') return;
          const chunk = this.parseChunk(payload);
          if (chunk !== null) yield { text: chunk };
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ServiceUnavailableException(`vLLM timed out after ${this.timeoutMs}ms`);
      }
      this.logger.warn(`vLLM call failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  private parseChunk(payload: string): string | null {
    try {
      const obj = JSON.parse(payload) as OpenAiChunk;
      if (obj.error?.message) {
        throw new ServiceUnavailableException(`vLLM error: ${obj.error.message}`);
      }
      const fragment = obj.choices?.[0]?.delta?.content ?? '';
      return fragment || null;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.debug(`Skipping malformed vLLM frame: ${payload.slice(0, 80)}`);
      return null;
    }
  }
}
