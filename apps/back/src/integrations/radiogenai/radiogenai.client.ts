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
    if (!this.configured) {
      throw new ServiceUnavailableException('AI integration not configured');
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();
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

      // The upstream is SSE / chunked text; we accumulate the whole
      // response and ship it back as a single string. Streaming directly
      // to the SPA is a Sprint-23 nice-to-have once the workflow is
      // stable.
      const text = await this.readBody(res);
      return {
        text,
        latencyMs: Date.now() - started,
        charCount: text.length,
      };
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

  private async readBody(res: Response): Promise<string> {
    if (!res.body) return await res.text();
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let out = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    // The upstream sometimes prefixes SSE chunks with `data: `; strip them
    // so the consumer gets a clean markdown string.
    return out
      .split(/\r?\n/)
      .map((l) => l.replace(/^data:\s?/, ''))
      .join('\n')
      .trim();
  }
}
