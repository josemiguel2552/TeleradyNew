import { mkdir, readFile, rename, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import chokidar from 'chokidar';
import type { Logger } from 'pino';
import type { AgentConfig } from './config.js';
import type { StowClient } from './stow-client.js';

/**
 * Watches `config.WATCH_FOLDER` and uploads each new file once it has
 * stopped growing for `STABILITY_THRESHOLD_MS`. Successful files move
 * to `ARCHIVE_FOLDER`; failures go to `QUARANTINE_FOLDER` so an operator
 * can review them.
 *
 * Bounded concurrency (config.MAX_CONCURRENT_UPLOADS) and infinite-retry
 * backoff on transient errors. We deliberately do NOT delete the source
 * file before getting a 2xx from the backend.
 */
export class FolderWatcher {
  private inflight = 0;
  private queue: string[] = [];
  private stopped = false;

  constructor(
    private readonly config: AgentConfig,
    private readonly client: StowClient,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    await mkdir(this.config.ARCHIVE_FOLDER, { recursive: true });
    await mkdir(this.config.QUARANTINE_FOLDER, { recursive: true });

    const watcher = chokidar.watch(this.config.WATCH_FOLDER, {
      ignoreInitial: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: this.config.STABILITY_THRESHOLD_MS,
        pollInterval: 250,
      },
      ignored: (path) => basename(path).startsWith('.'),
    });
    watcher.on('add', (path) => this.enqueue(path));
    this.logger.info(`watching ${this.config.WATCH_FOLDER}`);
  }

  stop(): void {
    this.stopped = true;
  }

  private enqueue(path: string): void {
    this.queue.push(path);
    this.pump();
  }

  private pump(): void {
    if (this.stopped) return;
    while (this.inflight < this.config.MAX_CONCURRENT_UPLOADS && this.queue.length > 0) {
      const path = this.queue.shift()!;
      this.inflight += 1;
      void this.process(path).finally(() => {
        this.inflight -= 1;
        this.pump();
      });
    }
  }

  private async process(path: string): Promise<void> {
    try {
      const stats = await stat(path);
      if (!stats.isFile()) return;
      const bytes = new Uint8Array(await readFile(path));
      const { status, bodyText } = await this.client.stow([{ name: basename(path), bytes }]);
      if (status >= 200 && status < 300) {
        await this.moveTo(path, this.config.ARCHIVE_FOLDER);
        this.logger.info({ path, status }, 'uploaded');
      } else {
        this.logger.warn({ path, status, bodyText }, 'upload rejected; quarantining');
        await this.moveTo(path, this.config.QUARANTINE_FOLDER);
      }
    } catch (err) {
      this.logger.error({ path, err: (err as Error).message }, 'upload failed, retrying later');
      // Re-enqueue with a small delay; transient errors recover.
      setTimeout(() => this.enqueue(path), 30_000);
    }
  }

  private async moveTo(path: string, folder: string): Promise<void> {
    const target = join(folder, `${Date.now()}-${basename(path)}`);
    await rename(path, target);
  }
}
