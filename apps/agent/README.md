# Telerady local agent

Small Node service the hospital installs on a machine inside its network.
Watches a folder for new DICOM files, pushes them to the Telerady backend
through STOW-RS at `/v1/pacs/dicom-web/studies`. The backend authenticates
the agent (JWT and/or mTLS) and proxies to the in-house Orthanc — the
hospital never has to expose Orthanc to the internet.

## Setup

```bash
cd apps/agent
npm install
cp .env.example .env
# edit .env with TELERADY_API_URL, the API token (or mTLS certs) and the
# watch / archive / quarantine folders.
npm run start:dev          # development (tsx watch)
npm run build && npm start  # production
```

## Folders

- `WATCH_FOLDER`: the hospital writes DICOM files here from its modalities.
- `ARCHIVE_FOLDER`: successful uploads land here, prefixed with timestamp.
- `QUARANTINE_FOLDER`: rejected files (4xx) end up here for review.

## Authentication

- **Bearer token**: long-lived JWT issued by the backend for a service user.
- **mTLS** (recommended for production): client certificate + key, optionally
  with a custom CA. When both are configured, the bearer token is still
  sent so the backend can authorise the request after TLS terminates.

## Ingestion flow

1. Agent uploads a multipart/related DICOM file to the STOW-RS endpoint.
2. Backend proxies to Orthanc; Orthanc returns a 2xx with the new instances.
3. Agent immediately calls `POST /v1/pacs/studies/sync` (Sprint 4 will wire
   this) so the backend creates the encrypted `report_study` row tagged
   with the hospital this agent belongs to.

## Operational notes

- Files smaller than `STABILITY_THRESHOLD_MS` are ignored until they stop
  growing (handles modalities that write in chunks).
- Network errors are retried indefinitely with a 30-second backoff. Files
  never delete from the watch folder before the backend acks with 2xx.
- Logs are pino-formatted; redact list strips Authorization headers and any
  field literally named "token".
- The agent does not parse DICOM; the backend (Orthanc) does. This keeps
  the agent's attack surface small.
