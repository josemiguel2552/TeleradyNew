import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrthancCreateDicomBody } from './dicom-sr-builder';

export interface ProxyResponse {
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
}

/**
 * Minimal HTTP client to Orthanc. Holds the base URL and the basic-auth
 * credentials and exposes a streaming proxy primitive for DICOMweb routes
 * plus a small set of typed helpers for the operations the rest of the app
 * needs (search studies, STOW-RS, retrieve study metadata).
 *
 * Uses global fetch (Node 22+) so no extra dependency is pulled in.
 */
@Injectable()
export class OrthancClient implements OnModuleInit {
  private baseUrl!: string;
  private authHeader!: string;
  private dicomWebRoot!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('ORTHANC_URL');
    if (!url) {
      // Allowed to be absent in unit tests; calls will throw if used.
      return;
    }
    const user = this.config.getOrThrow<string>('ORTHANC_USER');
    const password = this.config.getOrThrow<string>('ORTHANC_PASSWORD');
    this.baseUrl = url.replace(/\/$/, '');
    this.authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    this.dicomWebRoot = this.config.get<string>('ORTHANC_DICOMWEB_PATH') ?? '/dicom-web';
  }

  /**
   * Proxies a request to Orthanc and returns the streaming response. The
   * caller is responsible for wiring the stream into the HTTP response.
   */
  async proxy(
    method: string,
    pathAndQuery: string,
    headers: Record<string, string>,
    body?: BodyInit | null,
  ): Promise<ProxyResponse> {
    this.assertConfigured();
    const upstream = await fetch(`${this.baseUrl}${pathAndQuery}`, {
      method,
      headers: {
        ...headers,
        Authorization: this.authHeader,
      },
      body: body ?? undefined,
      // Node fetch streams body when given a ReadableStream.
      duplex: body ? 'half' : undefined,
    } as RequestInit);
    return {
      status: upstream.status,
      headers: upstream.headers,
      body: upstream.body,
    };
  }

  /** DICOMweb-rooted proxy. The caller passes the path after `/dicom-web`. */
  dicomWebProxy(
    method: string,
    suffix: string,
    headers: Record<string, string>,
    body?: BodyInit | null,
  ): Promise<ProxyResponse> {
    const cleanSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return this.proxy(method, `${this.dicomWebRoot}${cleanSuffix}`, headers, body);
  }

  /**
   * Builds a DICOM instance from a JSON description and uploads it via
   * Orthanc's /tools/create-dicom endpoint (the same path the SR builder
   * targets in its docstring). Returns the new instance + parent IDs as
   * Orthanc reports them, or null when the upload is rejected.
   * Best-effort: callers (sr-pusher) swallow failures so the signing
   * flow stays untouched.
   */
  async pushDicomFromJson(
    body: OrthancCreateDicomBody,
  ): Promise<{ id: string; parentStudy?: string; parentSeries?: string } | null> {
    this.assertConfigured();
    const res = await fetch(`${this.baseUrl}/tools/create-dicom`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ID: string;
      ParentStudy?: string;
      ParentSeries?: string;
    };
    return {
      id: data.ID,
      parentStudy: data.ParentStudy,
      parentSeries: data.ParentSeries,
    };
  }

  async findStudyByUid(studyInstanceUid: string): Promise<OrthancStudy | null> {
    this.assertConfigured();
    const res = await fetch(`${this.baseUrl}/tools/find`, {
      method: 'POST',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Level: 'Study',
        Query: { StudyInstanceUID: studyInstanceUid },
        Expand: true,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OrthancStudy[];
    return data[0] ?? null;
  }

  private assertConfigured(): void {
    if (!this.baseUrl) {
      throw new Error('Orthanc client is not configured (ORTHANC_URL missing)');
    }
  }
}

export interface OrthancStudy {
  ID: string;
  MainDicomTags: {
    StudyInstanceUID: string;
    StudyDescription?: string;
    StudyDate?: string;
    StudyTime?: string;
    AccessionNumber?: string;
    PatientID?: string;
  };
  PatientMainDicomTags?: {
    PatientID?: string;
    PatientName?: string;
    PatientBirthDate?: string;
    PatientSex?: string;
  };
  Series?: string[];
  ModalitiesInStudy?: string[];
  InstitutionName?: string;
}
