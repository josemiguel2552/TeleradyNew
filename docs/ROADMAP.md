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

## Sprint 2 — Orthanc + OHIF + S3 (en curso)

- [x] Proxy DICOMweb autenticado en NestJS (`/v1/pacs/dicom-web/*`)
  con stream pass-through y JWT + roles.
- [x] `PacsController`: `/v1/pacs/studies/search` (QIDO-RS normalizado) y
  `/v1/pacs/viewer/:uid` (URL OHIF construida por el back).
- [x] Front: `StudiesService` apunta al proxy del back; nuevo
  `OhifViewerComponent` que embebe OHIF en iframe sandboxed.
- [x] `StorageService` (AWS SDK v3 contra MinIO/S3) con SSE-S3, signed
  URLs (5 min) y buckets separados para informes y documentos.
- [x] Migración Drive → S3 para `professional_document`. Borrado del
  módulo `integrations/google`, sus deps y vars de entorno.
- [ ] STOW-RS post-hook que persiste `report_study` con `hospital_id` y
  campos cifrados (queda Sprint 3).
- [ ] TenantScope aplicado en todos los repos clínicos (queda Sprint 3
  cuando el contexto de usuario fluya por los handlers).
- [ ] Postgres RLS — sigue diferido (ver `docs/RLS-PLAN.md`).

## Sprint 3 — Ingesta + tenant context + agente local (en curso)

- [x] `AuthenticatedUser` propagado por commands/queries vía
  `@CurrentUser()`. `SaveReportDto` y `RegisterEventDto` ya no aceptan
  `idProfessional`; el handler lo deriva del JWT y exige hospital scope
  explícito para usuarios multi-tenant.
- [x] `TenantScope` aplicado en `ReportRepository` (find/insert/update);
  el resto de repos clínicos quedará cubierto cuando reescribamos sus
  handlers en el Sprint 5.
- [x] `POST /v1/pacs/studies/sync` consulta Orthanc por
  `StudyInstanceUID`, encripta los tags PII y persiste `report_study`
  con `hospital_id`. Cada ingestión emite un evento en `audit_log` con
  el `pat_id` pseudonimizado, nunca en claro.
- [x] Migración SQL de RLS en `infra/migrations/001-enable-rls.sql`
  (roles `telerady_app`/`telerady_migrator` + policies por tabla) y
  `RlsContextInterceptor` listo para activar con `RLS_ENABLED=true`.
- [x] Agente local (`apps/agent`): watcher chokidar + cliente
  STOW-RS con bearer JWT y/o mTLS, archive/quarantine folders y
  reintentos. CI cubre build del agente.
- [ ] Activación efectiva de RLS en staging + tests E2E de aislamiento
  (Sprint 4 al refactorizar repos restantes).
- [ ] Agente: post-call automático a `/v1/pacs/studies/sync` tras cada
  upload exitoso (Sprint 5 cuando el flujo del radiólogo lo necesite).

## Sprint 4 — Portal radiólogo (en curso)

- [x] Back: `GET /v1/worklist` y `/v1/worklist/:id` con `TenantScope`,
  paginación y filtros (modality / stateId / studyDate / hospitalId).
  Los campos PII se descifran en el repositorio antes de devolverlos.
- [x] Front: nueva área `/radiologist/*` con componentes **standalone**
  (signals + PrimeNG):
  - `WorklistComponent`: tabla lazy con filtros (modalidad, estado).
  - `StudyViewerComponent`: cabecera de paciente + visor OHIF en iframe.
- [x] Guardia ligera `radiologistGuard` que valida el rol del JWT antes
  de entrar; el back vuelve a validar en cada request.
- [ ] Migración progresiva del resto del portal legacy a standalone +
  signals (queda en backlog conforme cada página se rehaga).
- [ ] Activación efectiva de RLS en staging + tests E2E de aislamiento
  (cierra al completar el flujo de informe en Sprint 5).

## Sprint 5 — Editor de informe + firma (en curso)

- [x] Back: tabla `telerady.report` (1:1 con `report_study`), state machine
  draft → finalized → signed → sent, contenido cifrado (AES-256-GCM) y
  versión incremental.
- [x] Endpoints `/v2/reports/:reportStudyId{GET,PUT,/sign,/send}` con
  TenantScope y auditoría hash-chained en cada transición.
- [x] `SignatureService` con dos políticas por hospital:
  - `name_collegiate`: nombre + colegiado renderizado al pie.
  - `drawn_hash_tsa`: firma manuscrita PNG + sha256 del bundle + sello
    de tiempo TSA (mock interno, se sustituye por proveedor eIDAS
    cualificado en Sprint 8).
- [x] `PdfService` (pdfkit) renderiza el informe y lo sube a S3 con
  SSE-S3; el front recibe URL firmada (5 min) en cada GET.
- [x] Front: `ReportEditorComponent` standalone con autosave debounced
  (800 ms), plantillas por modalidad, `SignReportDialog` y
  `SignatureCanvas`. Estado bloqueado en signed/sent.
- [ ] PDF/A formal + integración real con TSA cualificado eIDAS
  (Sprint 8).

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
