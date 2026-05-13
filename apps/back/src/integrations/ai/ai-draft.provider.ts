/**
 * Contract every AI-draft backend must satisfy. The platform speaks
 * to this interface only; the concrete implementation is selected at
 * boot time by `AiModule` based on the `AI_DRAFT_PROVIDER` env var.
 *
 * Two implementations ship today:
 *   - `RadiogenAIProvider` — external service, server-to-server with
 *     `x-api-key`. Default. Implies a data-processor (RGPD art. 28).
 *   - `OllamaProvider` — talks to a local Ollama (or any
 *     `/api/generate` NDJSON-compatible runtime) on the operator's
 *     own network. No data leaves the perimeter, art. 28 is N/A.
 *
 * Privacy contract (enforced upstream by `AiDraftService`):
 *   - `findings` and `reportTitle` are the only fields any provider
 *     ever receives. Patient identifiers, DICOM tags and report IDs
 *     are never forwarded.
 */
export interface AiDraftRequest {
  findings: string;
  reportTitle: string;
  language?: 'es' | 'en';
}

export interface AiDraftResult {
  text: string;
  latencyMs: number;
  charCount: number;
}

export interface AiDraftStreamChunk {
  text: string;
}

export interface AiDraftStreamSummary {
  latencyMs: number;
  charCount: number;
}

export interface AiDraftProvider {
  /** Stable label for audit / metrics ("radiogenai" | "ollama"). */
  readonly providerName: 'radiogenai' | 'ollama';
  /** Whether the impl has the env vars it needs to run. */
  readonly configured: boolean;
  generate(request: AiDraftRequest): Promise<AiDraftResult>;
  generateStream(
    request: AiDraftRequest,
    onClose?: (summary: AiDraftStreamSummary) => void,
  ): AsyncGenerator<AiDraftStreamChunk, void, unknown>;
}

/** DI token. Inject with `@Inject(AI_DRAFT_PROVIDER)`. */
export const AI_DRAFT_PROVIDER = Symbol('AI_DRAFT_PROVIDER');
