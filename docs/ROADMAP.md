# Roadmap — Telerady

Trabajo planificado por sprints. Las fechas son orientativas: cada sprint cierra
cuando los criterios de aceptación están verdes, no por calendario.

## Sprint 0 — Hardening de seguridad (en curso)

**Objetivo**: blindar la base legacy antes de añadir funcionalidad.

- Tooling raíz, docs fundacionales, docker-compose dev.
- Crypto util AES-256-GCM (sustituye CryptoJS ECB).
- Argon2id utility lista para Sprint 1.
- Validación de entorno con Zod.
- Helmet, CORS allowlist, Throttler, HSTS, cookie-parser.
- Guards JWT habilitados, strategy endurecida.
- RBAC primitives con CASL.
- Audit log con hash chain.
- Pseudonimización en event_log, sanitización en Drive.
- pino con redaction, Swagger detrás de auth en prod.
- Front: eliminar `bypassSecurityTrustHtml`, plan de tokens, CSP scaffolding.
- CI GitHub Actions con gitleaks.

## Sprint 1 — Multi-tenant + Auth + Hospital (en curso)

- [x] Modelo `hospital` y `app_user` rediseñado en schema telerady.
- [x] `auth.controller v1`: register-hospital, login, refresh, logout, me, MFA.
- [x] Roles efectivos: radiologist, hospital_user, hospital_admin, coordinator, admin.
- [x] Cifrado por columna activado en `report_study` (Sprint 2 reescribirá
  los repos restantes para usarlo igualmente).
- [x] Token storage en el front: httpOnly cookie de refresh + access en memoria.
- [x] CLI `npm run seed:admin` para bootstrap del primer admin.
- [ ] Postgres RLS — diferido a Sprint 2 (ver `docs/RLS-PLAN.md`).

## Sprint 2 — Orthanc + OHIF

- `infra/docker-compose.dev.yml` con Orthanc configurado.
- Proxy DICOMweb autenticado en NestJS (`/v1/pacs/*`).
- Upload web: STOW-RS desde Angular.
- OHIF embebido en iframe con configuración por tenant.
- Migración del bucket de documentos profesionales de Drive a S3.

## Sprint 3 — Agente local del hospital

- App Node/Electron empaquetada.
- Watcher de carpeta DICOM con cifrado local antes de subir.
- Auth por mTLS contra el backend.
- Gestión de reintentos y modo offline.

## Sprint 4 — Portal radiólogo (refactor)

- Migración progresiva a standalone components + signals.
- Lista de trabajo real, filtros, búsqueda.
- Apertura del visor OHIF, comparación con previas.
- Página de detalle del estudio con tags relevantes.

## Sprint 5 — Editor de informe + firma

- Editor con plantillas por modalidad (TC, RX, RM, ECO).
- Almacenamiento estructurado del informe (no sólo PDF).
- Firma configurable por hospital:
  - Modo simple: nombre + colegiado al pie.
  - Modo avanzado: firma manuscrita en canvas + hash + TSA.
- Generación de PDF/A archivable.

## Sprint 6 — Portal admin / coordinador

- Asignación de estudios a radiólogos (manual y por reglas).
- Verificación intermedia (segundo informe opcional).
- Envío final al hospital.
- Gestión de incidencias.
- SLA dashboard básico.
- Derechos del interesado RGPD.

## Sprint 7 — Audit UI + notificaciones + estadísticas

- UI para auditoría y verificación del hash chain.
- Notificaciones por email y push (Web Push API).
- Estadísticas reales por hospital y radiólogo.

## Sprint 8 — Compliance & operación

- Pen-test interno y plan de remediación.
- DPIA y ROPA finales.
- Contratos art. 28 firmados.
- Procedimientos de brecha y soporte 24×7.
- Documentación ENS categoría media.

## Backlog y futuro

- IA de borrador (radiogenia o equivalente) — reincorporable cuando el flujo
  base esté estable.
- Workflows DICOM avanzados (Modality Performed Procedure Step, structured reports).
- Integración HL7/FHIR para hospitales que lo soliciten.
- App móvil para alertas urgentes.
