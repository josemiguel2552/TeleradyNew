import pino from 'pino';
import type { AgentConfig } from './config.js';

export function buildLogger(config: AgentConfig) {
  return pino({
    level: config.LOG_LEVEL,
    transport:
      process.stdout.isTTY
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
    redact: {
      paths: [
        'config.TELERADY_API_TOKEN',
        '*.token',
        '*.headers.authorization',
      ],
      censor: '[REDACTED]',
    },
  });
}
