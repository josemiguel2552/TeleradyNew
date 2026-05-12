import { readFile } from 'node:fs/promises';
import { Agent, fetch } from 'undici';
import type { AgentConfig } from './config.js';

/**
 * Thin client for the backend STOW-RS proxy.
 *
 * Uses the platform JWT (long-lived service account on the hospital side)
 * and, optionally, mTLS for transport-level mutual auth. Both auths are
 * accepted by the proxy; mTLS is recommended for production.
 */
export class StowClient {
  private readonly dispatcher: Agent | undefined;

  constructor(private readonly config: AgentConfig) {
    if (config.TELERADY_CLIENT_CERT && config.TELERADY_CLIENT_KEY) {
      this.dispatcher = new Agent({
        connect: {
          // Resolved lazily by setupTls() before the first request.
        },
      });
    }
  }

  async setupTls(): Promise<void> {
    if (!this.dispatcher) return;
    const cert = await readFile(this.config.TELERADY_CLIENT_CERT!);
    const key = await readFile(this.config.TELERADY_CLIENT_KEY!);
    const ca = this.config.TELERADY_CA ? await readFile(this.config.TELERADY_CA) : undefined;
    // undici Agents accept TLS options through the constructor; rebuild it
    // now that we have the files in memory.
    (this as any).dispatcher = new Agent({
      connect: { cert, key, ca },
    });
  }

  /**
   * Posts one or more DICOM files as a multipart/related body to the
   * backend's STOW-RS proxy. The proxy validates the bearer token and
   * forwards to Orthanc with its own credentials.
   */
  async stow(files: { name: string; bytes: Uint8Array }[]): Promise<{ status: number; bodyText: string }> {
    const boundary = `telerady-${Math.random().toString(36).slice(2, 10)}`;
    const parts: Uint8Array[] = [];
    for (const file of files) {
      const header =
        `\r\n--${boundary}\r\n` +
        `Content-Type: application/dicom\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
        `\r\n`;
      parts.push(new TextEncoder().encode(header));
      parts.push(file.bytes);
    }
    parts.push(new TextEncoder().encode(`\r\n--${boundary}--\r\n`));

    const body = concat(parts);
    const url = `${this.config.TELERADY_API_URL.replace(/\/$/, '')}/v1/pacs/dicom-web/studies`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
        Accept: 'application/dicom+json',
        ...(this.config.TELERADY_API_TOKEN
          ? { Authorization: `Bearer ${this.config.TELERADY_API_TOKEN}` }
          : {}),
      },
      body,
      dispatcher: this.dispatcher,
    });
    const bodyText = await res.text();
    return { status: res.status, bodyText };
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
