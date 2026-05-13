# Telerady

![CI](https://github.com/josemiguel2552/teleradynew/actions/workflows/ci.yml/badge.svg?branch=main)
![License: UNLICENSED](https://img.shields.io/badge/license-UNLICENSED-lightgrey)
![Node](https://img.shields.io/badge/node-22-brightgreen)
![Nest](https://img.shields.io/badge/nest-11-red)
![Angular](https://img.shields.io/badge/angular-19-red)
![Postgres](https://img.shields.io/badge/postgres-16-blue)

Plataforma de teleradiología compliant con RGPD / LOPDGDD / ENS para conectar
hospitales con radiólogos remotos.

## Estructura del monorepo

```
apps/
  back/       Backend NestJS 11 (REST + DICOMweb proxy + auth + reports)
  front/      Frontend Angular 19 (portal profesional, hospital y admin)
docs/         Arquitectura, threat model, RGPD checklist, roadmap
infra/        docker-compose, manifests y scripts de despliegue
```

Trabajos en curso y plan: [`docs/ROADMAP.md`](docs/ROADMAP.md).
Modelo de amenazas: [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md).
Cumplimiento RGPD: [`docs/RGPD-CHECKLIST.md`](docs/RGPD-CHECKLIST.md).
Política de reporte de vulnerabilidades: [`SECURITY.md`](SECURITY.md).

## Arranque rápido (desarrollo)

¿Sólo quieres probar la plataforma sin leer código? Sigue
[`docs/QUICKSTART.md`](docs/QUICKSTART.md) paso a paso.

Si ya tienes Docker + Node 22 listos:

```bash
cp .env.example .env
make demo          # arranca infra, instala y siembra datos demo
# en dos terminales nuevas:
make back          # API en http://localhost:3000
make front         # SPA en http://localhost:4200
```

Credenciales tras `make seed` (o `npm run seed:demo` desde `apps/back`):

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@telerady.test` | `AdminDemo!2026` | admin |
| `pepa@telerady.test` | `RadDemo!2026` | radiologist |
| `hospital@telerady.test` | `HospitalDemo!2026` | hospital_admin |

## Stack

- **Back**: NestJS 11, Drizzle ORM, Postgres 16, Redis 7, BullMQ, pino, argon2id, CASL.
- **Front**: Angular 19 + signals + standalone components, PrimeNG, Tailwind.
- **PACS**: Orthanc + OHIF (embebido vía iframe).
- **Storage**: MinIO (dev) / S3-compatible soberano (prod).
- **Crypto**: AES-256-GCM por columna, argon2id para passwords, MFA TOTP.
- **IA**: `AiDraftProvider` con tres implementaciones intercambiables
  por env (RadiogenAI SaaS, Ollama local, vLLM/TGI local).
- **Observabilidad**: Prometheus + Grafana + Loki + Promtail
  (`infra/observability/`).
- **Notificaciones**: Web Push (RFC 8292 VAPID) en navegador / PWA.
- **HL7**: MLLP server inbound (ORM/MWL); ORU outbound; MPPS webhook.
- **DICOM**: DICOMweb proxy a través del back; STOW-RS, QIDO-RS,
  WADO-RS; Structured Reports al firmar.

## OpenAPI

La spec completa está commiteada en
[`docs/openapi.json`](docs/openapi.json) (regenerable con
`npm --prefix apps/back run export:openapi`). Sirve para auto-generar
SDKs de clientes con `openapi-generator` y como contrato versionado
en cada PR.

## Branches

Desarrollo en `claude/teleradiology-platform-setup-N8LCt`.
`main` es la rama estable hacia la que se mergea cuando un sprint cierra.
