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

## Sprint 6 — Portal admin/coordinador + RGPD (en curso)

- [x] Back: `PUT /v1/admin/studies/:id/assign` (admin/coordinator)
  reasigna primario y opcional reviewer; TenantScope sobre hospital;
  auditoría `study.assigned`.
- [x] Back: `GET /v1/admin/dashboard/sla` con conteos por estado,
  averages minutes-to-sign / sign-to-sent, y pendientes > SLA 24h.
- [x] Back: `GET /v1/me/data-export` (RGPD art. 15) y `DELETE /v1/me`
  (RGPD art. 17) con tombstone + auditoría.
- [x] Front: `/admin/*` standalone con SLA dashboard, asignaciones
  (lista + diálogo de reassign) y "My data" RGPD.
- [x] Docs: `docs/RLS-ACTIVATION-RUNBOOK.md` con el procedimiento
  paso a paso para activar RLS en producción.
- [ ] Activación efectiva de RLS en staging + tests E2E con
  testcontainers (Sprint 7).
- [ ] Limitación de tratamiento (art. 18) + portabilidad DICOM zip
  (Sprint 7).

## Sprint 7 — Audit UI + notificaciones + RGPD restante (en curso)

- [x] Back: `GET /v1/admin/audit` (lista paginada con TenantScope y
  filtros action/hospital/actor) y `POST /v1/admin/audit/verify`
  (replay del hash chain con detección del primer registro inválido).
- [x] Back: `GET /v1/admin/professionals` (búsqueda paginada por
  nombre/apellido/email) para alimentar el dropdown de asignaciones.
- [x] Back: `NotificationsModule` (@Global) con `sendEmail` (stub
  estructurado) y `fireWebhook` (HMAC-SHA256 + reintentos lineales).
  Webhook/email opcional en `report.sent`.
- [x] Back: RGPD art. 18 — columna `app_user.processing_restricted`
  + `PATCH /v1/me/processing-restriction` con auditoría.
- [x] Front: `/admin/audit` con tabla lazy + botón Verify chain; el
  dropdown de asignaciones consulta `/v1/admin/professionals` con
  búsqueda server-side.
- [ ] Push notifications (Web Push API) — backlog.
- [ ] Gráficas por hospital y radiólogo — backlog.

## Sprint 8 — Compliance & operación

- [x] Plantillas vivas:
  - `docs/ROPA.md` (Registro de actividades de tratamiento).
  - `docs/DPIA-template.md` (Evaluación de impacto).
  - `docs/breach-procedure.md` (notificación AEPD <72h).
  - `docs/ENS-mapping.md` (mapeo a Esquema Nacional de Seguridad media).
- [ ] Auditor ENS acreditado contratado y primera auditoría completada.
- [ ] DPO designado y notificado a la AEPD.
- [ ] Contratos art. 28 firmados con cada encargado de tratamiento.
- [ ] Sustituir `TsaService` mock por proveedor eIDAS cualificado.
- [ ] Generación de PDF/A archivable (postprocesador sobre pdfkit).
- [ ] Pen-test interno + plan de remediación.
- [ ] DR plan documentado + drill trimestral.

## Sprint 9 — Workflow interno (en curso)

- [x] `telerady.assignment_rule` (hospital + modality + subspecialty)
  + `WorkflowEngine.decide/applyToStudy` aplicado en
  `PacsIngestService.sync` (sólo en primera ingesta).
- [x] Segunda lectura: `report.requires_review` / `reviewer_*` y
  `POST /v1/reports/:reportStudyId/review` (rechazo vuelve a draft +
  versión++).
- [x] CRUD de reglas (`GET/POST/DELETE /v1/admin/assignment-rules`).
- [x] `POST /v1/admin/sla/escalate?minutes=` registra
  `workflow.sla_breach_escalated` por cada estudio vencido.

## Sprint 10 — Interop HL7v2 + DICOM MWL (en curso)

- [x] Schema: `telerady.mwl_entry` (paciente cifrado) y
  `telerady.hl7_message` (payload cifrado).
- [x] Codec HL7 v2 propio (parser + escapes + ACK builder).
- [x] Mapper ORM/OMI/OMG → MWL row y constructor ORU^R01 desde un
  informe firmado.
- [x] `Hl7MllpServer` (VT/FS framing) + `Hl7MllpClient` con timeout.
  Disabled por defecto (`HL7_MLLP_ENABLED=false`); producción detrás
  de Stunnel/nginx stream con mTLS.
- [x] `/v1/mwl` CRUD para crear/cancelar entradas y listar las
  visibles al actor.

## Sprint 11 — FHIR R4 (en curso)

- [x] `/fhir/metadata` CapabilityStatement.
- [x] `/fhir/Patient/:id` (busca por `pat_id_hash`).
- [x] `/fhir/ImagingStudy` (search por `patient` y `modality`).
- [x] `/fhir/DiagnosticReport/:id` y `/fhir/DiagnosticReport` (search
  por `patient` y `status`) con `presentedForm` apuntando a la URL
  firmada del PDF (TTL 5 min).
- [ ] Capacidad de **escritura** desde el HIS (POST DiagnosticReport)
  — queda en backlog hasta que un hospital concreto lo pida.
- [ ] SMART-on-FHIR Backend Services — backlog.

## Backlog y futuro

- IA de borrador (radiogenia o equivalente) — reincorporable cuando el flujo
  base esté estable.
- Workflows DICOM avanzados (Modality Performed Procedure Step,
  Structured Reports DICOM SR).
- App móvil para alertas urgentes.
