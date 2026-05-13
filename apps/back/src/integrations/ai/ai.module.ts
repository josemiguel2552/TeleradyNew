import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_DRAFT_PROVIDER, AiDraftProvider } from './ai-draft.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { RadiogenAIProvider } from './providers/radiogenai.provider';

/**
 * Boot-time factory that picks the concrete provider based on the
 * `AI_DRAFT_PROVIDER` env var. Both providers are still constructed
 * (cheap, just reads env vars) so the operator can hot-swap by
 * flipping the var and rolling the pod without a code change.
 *
 *   AI_DRAFT_PROVIDER=radiogenai   (default — external)
 *   AI_DRAFT_PROVIDER=ollama       (local — no data leaves perimeter)
 *   AI_DRAFT_PROVIDER=disabled     (or any other value, including
 *                                   unset → returns a provider with
 *                                   configured=false so the
 *                                   /ai-draft endpoint replies 503)
 */
@Module({
  providers: [
    RadiogenAIProvider,
    OllamaProvider,
    {
      provide: AI_DRAFT_PROVIDER,
      inject: [ConfigService, RadiogenAIProvider, OllamaProvider],
      useFactory: (
        config: ConfigService,
        radiogenai: RadiogenAIProvider,
        ollama: OllamaProvider,
      ): AiDraftProvider => {
        const choice = (config.get<string>('AI_DRAFT_PROVIDER') ?? 'radiogenai').toLowerCase();
        const logger = new Logger('AiModule');
        if (choice === 'ollama') {
          logger.log(`AI draft provider: ollama (configured=${ollama.configured})`);
          return ollama;
        }
        if (choice === 'radiogenai') {
          logger.log(`AI draft provider: radiogenai (configured=${radiogenai.configured})`);
          return radiogenai;
        }
        logger.warn(`AI_DRAFT_PROVIDER="${choice}" → AI drafts disabled`);
        return {
          providerName: 'radiogenai',
          configured: false,
          async generate() {
            throw new Error('AI draft provider disabled');
          },
          async *generateStream() {
            throw new Error('AI draft provider disabled');
          },
        } as AiDraftProvider;
      },
    },
  ],
  exports: [AI_DRAFT_PROVIDER],
})
export class AiModule {}
