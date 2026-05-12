import {
  All,
  Controller,
  Logger,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../auth/roles';
import { OrthancClient } from './orthanc-client.service';

/**
 * DICOMweb pass-through.
 *
 * Every request is authenticated by the platform JWT first, then forwarded
 * to Orthanc with the backend's own credentials. The client never sees the
 * Orthanc URL nor its basic auth, and Orthanc never sees the end-user JWT —
 * a clean separation of trust.
 *
 * Authorisation is intentionally permissive within authenticated roles for
 * Sprint 2: hospital users, radiologists, coordinators and admins can hit
 * the proxy. Per-study tenant enforcement will land alongside RLS once the
 * study-tenant link is populated for every study (Sprint 3).
 */
@ApiExcludeController()
@Controller({ path: 'pacs/dicom-web', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.Admin, Role.Coordinator, Role.HospitalAdmin, Role.HospitalUser, Role.Radiologist)
@ApiBearerAuth()
export class DicomWebController {
  private readonly logger = new Logger(DicomWebController.name);

  constructor(private readonly orthanc: OrthancClient) {}

  @All('*')
  async proxy(
    @Param('0') suffix: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const path = `/${suffix ?? ''}${search}`;
    const headers = forwardableRequestHeaders(req.headers);

    let body: BodyInit | undefined;
    if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
      // Stream the express request straight to upstream so STOW-RS uploads
      // of multi-MB DICOM payloads don't get buffered in memory.
      body = Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>;
    }

    try {
      const upstream = await this.orthanc.dicomWebProxy(req.method, path, headers, body);
      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (isResponseHeaderForwardable(key)) {
          res.setHeader(key, value);
        }
      });
      if (!upstream.body) {
        res.end();
        return;
      }
      const reader = upstream.body.getReader();
      const pump = async (): Promise<void> => {
        const { value, done } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        if (!res.write(Buffer.from(value))) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
        return pump();
      };
      await pump();
    } catch (err) {
      this.logger.error(`Orthanc proxy failed for ${req.method} ${path}: ${(err as Error).message}`);
      if (!res.headersSent) res.status(502).json({ message: 'PACS upstream error' });
      else res.end();
    }
  }
}

const REQ_FORWARD_SKIPLIST = new Set([
  'host',
  'connection',
  'content-length',
  'authorization',
  'cookie',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
]);

function forwardableRequestHeaders(
  headers: Request['headers'],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (REQ_FORWARD_SKIPLIST.has(name.toLowerCase())) continue;
    if (typeof value === 'string') out[name] = value;
    else if (Array.isArray(value)) out[name] = value.join(', ');
  }
  return out;
}

const RES_FORWARD_SKIPLIST = new Set([
  'connection',
  'content-length',
  'transfer-encoding',
  'set-cookie',
  'www-authenticate',
]);

function isResponseHeaderForwardable(key: string): boolean {
  return !RES_FORWARD_SKIPLIST.has(key.toLowerCase());
}
