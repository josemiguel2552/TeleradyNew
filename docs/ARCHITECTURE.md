# Arquitectura — Telerady

## 1. Visión

Plataforma de teleradiología que conecta hospitales y radiólogos remotos para
informar estudios DICOM con garantías clínicas y de cumplimiento normativo.

Tres roles principales:
- **Radiólogo**: recibe lista de trabajo, abre visor, escribe y firma informe.
- **Hospital**: sube/empuja estudios, recibe informes firmados, gestiona usuarios.
- **Admin / coordinador**: asigna estudios, verifica casos, gestiona SLAs.

## 2. Componentes

```
┌────────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR / EDGE                          │
│  Angular 19  (PWA, manifest + Service Worker)                      │
│      ├── push handler (RFC 8292 VAPID)                             │
│      ├── editor + AI draft (SSE consumer)                          │
│      └── iframe OHIF (visor DICOM, comunicación PostMessage)       │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ TLS 1.3
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY / BFF                          │
│  NestJS 11                                                         │
│  ├── REST + SSE             (módulos por dominio)                  │
│  ├── DICOMweb proxy         (proxy autenticado a Orthanc)          │
│  ├── HL7 v2 MLLP server     (ORM inbound, ORU outbound)            │
│  ├── MPPS webhook receiver  (Orthanc Lua → POST /v1/integrations…) │
│  ├── BullMQ workers         (audit verify, ORU sender, push, …)    │
│  ├── Web Push sender        (web-push, VAPID)                      │
│  ├── AI draft provider      (RadiogenAI | Ollama | vLLM)           │
│  └── pino logger + audit hash chain                                │
└──┬───────────┬──────────────┬────────────────┬─────────────────────┘
   │           │              │                │
   ▼           ▼              ▼                ▼
┌──────┐   ┌────────┐   ┌──────────┐   ┌─────────────────┐
│ PG16 │   │ Redis7 │   │  MinIO   │   │     Orthanc     │
│      │   │        │   │  / S3    │   │  (PACS DICOMweb)│
└──────┘   └────────┘   └──────────┘   └─────────────────┘
                                              ▲
                                              │ STOW-RS / C-STORE
                              ┌───────────────┴───────────────┐
                              │  Agente local (hospital)      │
                              │  Watcher carpeta + cifrado +  │
                              │  push autenticado vía mTLS    │
                              └───────────────────────────────┘
```

## 3. Decisiones técnicas

| Decisión | Opción elegida | Motivación |
|---|---|---|
| Lenguaje back | TypeScript + NestJS 11 | Tipado, ecosistema, ya en uso |
| ORM | Drizzle | SQL-first, tipado, migraciones explícitas |
| BD | Postgres 16 | Robustez, RLS, pgcrypto, jsonb |
| PACS | Orthanc | Open source, DICOMweb nativo, RBAC plugin |
| Visor | OHIF 3 | Estándar, accesible, mantenido |
| Storage | MinIO / S3 soberano | Datos clínicos en España |
| Hash passwords | argon2id | Estándar OWASP 2024 |
| Cifrado columna | AES-256-GCM | Autenticado, NIST-approved |
| Auth | JWT corto + refresh httpOnly | Buen compromiso seg/UX |
| Authz | CASL | Granular, ya idiomático en Nest |
| Logs | pino | Performante, structured, redaction |
| Colas | BullMQ | Redis, retries, schedulers |
| MFA | TOTP RFC 6238 | Sin dependencia de SMS/Telco |

## 4. Multitenancy

Todo recurso clínico lleva `hospital_id`. Los profesionales son globales pero
sólo ven trabajos asignados desde hospitales con los que tienen contrato.

Estrategia de aislamiento:
1. Filtro automático en repositorios (`tenant_scope` aplicado en cada query).
2. Postgres Row-Level Security como red de seguridad adicional en tablas críticas.
3. Pruebas de integración que verifican que un usuario de hospital A nunca
   puede leer recursos de hospital B.

## 5. Capa de cifrado

- **En tránsito**: TLS 1.3 obligatorio.
- **En reposo BD**: cifrado por columna con AES-256-GCM. Patrón envelope:
  - DEK aleatorio por registro (o por hospital, según tabla).
  - DEK cifrado con KEK extraído de HashiCorp Vault.
  - El backend nunca persiste KEK en disco.
- **En reposo S3**: SSE con clave gestionada por Vault (SSE-C en MinIO; KMS
  cuando exista en el proveedor soberano).
- **Pseudonimización**: `pat_id` se hashea con HMAC-SHA256 + pepper antes de
  loguear o entrar en eventos analíticos.

## 6. Firma de informes

Configurable por hospital (`hospital.signature_policy`):
- `name_collegiate`: nombre + número de colegiado al pie del PDF.
- `drawn_hash_tsa`: firma manuscrita capturada en canvas + hash SHA-256 +
  sello de tiempo TSA externo (proveedor cualificado eIDAS).

El radiólogo nunca sube certificado personal (FNMT, AutoFirma quedan fuera).

## 7. Trazabilidad

Tabla `audit_log` append-only con hash chain:

```
record { id, ts, actor_id, action, target_kind, target_id, payload, prev_hash, hash }
hash = sha256(prev_hash || canonical(record_sin_hash))
```

Verificable de forma independiente. Backup periódico off-site con sello de tiempo.

## 8. Retención

- Tabla `retention_policy(hospital_id, kind, days, action)`.
- Job nocturno aplica políticas: borrado lógico → físico → purga S3.
- Excepciones legales se marcan con `legal_hold = true`.

## 9. IA de borrador (provider abstraction)

`AiDraftProvider` (`apps/back/src/integrations/ai/`) abstrae tres
implementaciones intercambiables por `AI_DRAFT_PROVIDER`:

| Valor | Wire format | Datos salen del perímetro |
|---|---|---|
| `radiogenai` | `POST /genreport` SSE `data:` lines + `x-api-key` | Sí — RGPD art. 28 aplica |
| `ollama` | `POST /api/generate` NDJSON | No |
| `vllm` | `POST /v1/chat/completions` OpenAI SSE `data: {…}` + opcional Bearer | No |

Todos hablan el mismo contrato (`generate`, `generateStream`,
`configured`, `providerName`) — el `AiDraftService` que orquesta
ignora cuál tiene detrás. El audit log graba `providerName` para
trazabilidad RGPD.

## 10. Notificaciones push

`PushService` (`apps/back/src/integrations/push/`) usa Web Push
(RFC 8292) con VAPID:

- Suscripción por dispositivo (`telerady.push_subscription`,
  `endpoint` UNIQUE, soft-delete via `revoked_at`).
- `sendToProfessional(professionalId, payload)` resuelve
  `app_user.professional_id` → `app_user.id` y delega a
  `sendToUser`.
- Cuando el push service responde 404/410, la suscripción se marca
  revocada automáticamente para que el siguiente envío no la
  reintente.
- Disparadores en producción: `study.assigned` (admin reasigna o
  workflow auto-asigna) y `study.urgent` (priority STAT/URGENT
  heredada del HL7 ORM via MWL).

## 11. Desarrollo local

`infra/docker-compose.dev.yml` levanta Postgres, Redis, MinIO,
Orthanc y Vault. `infra/observability/docker-compose.yml` añade
Prometheus + Loki + Promtail + Grafana con dos dashboards
provisionados (logs + métricas).

Front y back se ejecutan directamente con `npm start` para hot
reload. Para PWA install local, Angular + manifest + sw.js viven
en el bundle root.

## 12. Despliegue (objetivo)

Proveedor soberano español (Stackscale / Arsys / Jotelulu) con:
- Postgres gestionado o instancia dedicada con backups cifrados off-site.
- MinIO multi-nodo o S3 soberano.
- Orthanc dedicado por entorno.
- Vault HA.
- Reverse proxy con TLS terminado y headers de seguridad.
- Observabilidad: Loki / Grafana, alertas en PagerDuty/Opsgenie equivalente.

Imágenes Docker en `apps/back/Dockerfile` (multi-stage Node 22
alpine, non-root UID 1001, ~180 MB) y `apps/front/Dockerfile`
(multi-stage Angular + nginx 1.27 alpine, ~50 MB, sirve la SPA
+ /healthz). Ambos construidos en CI por el job `docker-images`
(no push: sólo verificación que los Dockerfiles compilan).
