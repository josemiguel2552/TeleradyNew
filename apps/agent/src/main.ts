import { loadConfig } from './config.js';
import { buildLogger } from './logger.js';
import { StowClient } from './stow-client.js';
import { FolderWatcher } from './watcher.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = buildLogger(config);
  const client = new StowClient(config);
  await client.setupTls();

  const watcher = new FolderWatcher(config, client, logger);
  await watcher.start();

  const shutdown = () => {
    logger.info('shutting down');
    watcher.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`agent failed to start: ${(err as Error).message}`);
  process.exit(1);
});
