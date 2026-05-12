# Telerady

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

```bash
# 1. Variables
cp .env.example .env

# 2. Servicios base (Postgres, Redis, MinIO, Orthanc, Vault)
docker compose -f infra/docker-compose.dev.yml up -d

# 3. Backend
cd apps/back && npm install && npm run start:dev

# 4. Frontend (en otra terminal)
cd apps/front && npm install && npm start
```

## Stack

- **Back**: NestJS 11, Drizzle ORM, Postgres 16, Redis 7, BullMQ, pino, argon2id, CASL.
- **Front**: Angular 19 + signals + standalone components, PrimeNG, Tailwind.
- **PACS**: Orthanc + OHIF (embebido vía iframe).
- **Storage**: MinIO (dev) / S3-compatible soberano (prod).
- **Crypto**: AES-256-GCM por columna, argon2id para passwords, MFA TOTP.

## Branches

Desarrollo en `claude/teleradiology-platform-setup-N8LCt`.
`main` es la rama estable hacia la que se mergea cuando un sprint cierra.
