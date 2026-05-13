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
- [x] Limitación de tratamiento (art. 18) entregado en sprints
  intermedios — `PATCH /v1/me/processing-restriction` (`me.controller.ts:52`).
- [x] Portabilidad DICOM zip (art. 20) entregada en Sprint 14 —
  `GET /v1/me/dicom-export` (`me.controller.ts:30`,
  `me/v1/dicom-export.service.ts`).
- [ ] Activación efectiva de RLS en staging + tests E2E con
  testcontainers (Sprint 7).

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

## Sprint 12-20 — Operación, robustez e integraciones (cerrado)

Sprints atómicos cortos enfocados en cerrar huecos operativos y
preparar producción. Todos ya pusheados.

- **Sprint 12 — Jobs (BullMQ)**: workers reales con Redis.
  - `sla-escalation` cada 15 min con deduplicación 24 h.
  - `oru-sender` con reintentos exponenciales y validación de ACK.
  - `webhook-delivery` con HMAC + reintentos exponenciales.
  - `audit-verify` horario que replay del hash chain.
  - `/v1/admin/jobs` con counts por cola para diagnóstico.
- **Sprint 13 — Tests E2E**: `npm run test:e2e` con
  `@testcontainers/postgresql` levanta un Postgres real, aplica el
  seed y verifica aislamiento entre tenants y detección de tamper en
  el audit log. Gated tras `E2E=1`.
- **Sprint 14 — RGPD art. 20 + DICOM SR**:
  - `GET /v1/me/dicom-export` streamea un ZIP con los estudios del
    profesional (manifest.json incluido).
  - `SrPusherService` empuja un Basic Text Structured Report al
    Orthanc del hospital cuando un informe se firma.
- **Sprint 15 — FHIR write + smoke runner + /login canónico**:
  - `POST /fhir/DiagnosticReport` para recibir informes del HIS.
  - `scripts/smoke.sh` end-to-end (auth → worklist → sign → audit →
    fhir → rgpd). Hook `make smoke`.
  - TokenInterceptor + AdminMe redirigen a `/login` (deprecated
    `/user/login`).
- **Sprint 16 — Observability**: stack opcional con Prometheus + Loki
  + Promtail + Grafana en `infra/observability/`. Dashboard
  "Telerady — API overview" provisionado.
- **Sprint 17 — `/metrics`**: prom-client con counters/histograms
  HTTP + por dominio (report_signed, report_sent, audit_appended,
  sla_pending). `MetricsInterceptor` global.
- **Sprint 18 — DR plan + backup/restore**:
  - `scripts/backup.sh` (pg_dump + sha256 + GPG + S3) y
    `scripts/restore.sh` idempotentes.
  - `docs/DR-PLAN.md` con RPO/RTO, cron, cut-over por escenario y
    drill trimestral.
- **Sprint 19 — Front jest tests**: specs para `LoginV2`,
  `WorklistService` y `ReportV2Service`.
- **Sprint 20 — Limpieza legacy**: `/user/**` redirige a `/login`;
  los archivos legacy quedan compilando hasta que un sprint posterior
  los elimine físicamente.

## Sprint 21 — IA de borrador (RadiogenAI, integración externa) (cerrado)

- [x] Schema: `hospital.ai_drafting_allowed` + `app_user.ai_consent_at`.
- [x] `RadiogenAIClient` aislado en `integrations/radiogenai/` con
  `x-api-key`, AbortController + timeout, parser SSE.
- [x] `AiDraftService` + `POST /v2/reports/:reportStudyId/ai-draft`
  con triple opt-in (plataforma / hospital / usuario), validación de
  scope, audit `report.ai_draft_requested` (nunca el texto) y métricas
  Prometheus (`telerady_ai_draft_requests_total`,
  `telerady_ai_draft_latency_seconds`).
- [x] Front: botón "AI draft" en `ReportEditorComponent`, banner de
  consentimiento al primer uso, inserción no destructiva en la sección
  "Conclusion" + autosave inmediato.
- [x] `docs/AI-INTEGRATION.md` (topología, contrato de privacidad,
  controles, resiliencia, RGPD art. 22 y 28).
- [x] Tests Jest del cliente (5) y del servicio (7) — `nest build`
  verde, suite global 161/161.

## Sprint 22 — Limpieza de deuda técnica (cerrado)

Sprint puente disparado al ejecutar `nest build` con `node_modules`
por primera vez en esta workspace. Destapó bugs introducidos en
sprints anteriores que el harness de la sandbox no podía detectar
sin dependencias instaladas:

- [x] `OrthancClient.pushDicomFromJson(body)` no existía aunque
  `SrPusherService` ya lo invocaba desde Sprint 14. Añadido contra
  `/tools/create-dicom` con tipo `OrthancCreateDicomBody`.
- [x] `MetricsService` no estaba inyectado en `ReportV2Service` aunque
  `report.signed` / `report.sent` ya pretendían incrementar contadores
  desde Sprint 17. Inyectado y operativo.
- [x] `MllpServer.onConnection` declaraba `framed: Buffer | null` y
  llamaba `.message`/`.rest` en él — el tipo del retorno del helper
  no compilaba. Reescrito con `while(true)`.
- [x] `AbilityFactory` (CASL): `MongoQuery<never>` rechazaba nuestras
  condiciones ad-hoc; helper `can` re-tipado en el factory boundary.
- [x] `JwtTokenService.signAccessToken` con `expiresIn` typed-string
  conflictivo: `JwtSignOptions` cast en una sola línea.
- [x] `main.ts` `app.set('trust proxy', 1)`: usa
  `getHttpAdapter().getInstance()` (Express) — necesario detrás de
  nginx / load balancer.
- [x] `ReportStartEvent.data` extiende ahora
  `SaveReportDto & { idProfessional: string }` (la columna salió del
  DTO público, pero el handler la sigue necesitando para el event log).
- [x] Specs v1 actualizados: `ability.factory.spec`, `aes-gcm.spec`,
  `event-log.spec`, `report.repository.spec`, `report.controller.spec`,
  `user-events.controller.spec`, `personal-data.repository.spec`,
  `professional-document.repository.spec`,
  `validate.handler.spec`, `get-uploaded-documents.handler.spec`,
  `get-subspecialties.handler.spec`, `worklist.repository.spec`,
  `save-professional.handler.spec`. Todos por desfase con el schema
  (`driveId` → `storageBucket`/`storageKey`), con la API
  (`SaveReportDto` perdió `idProfessional`, controllers ganaron
  `@CurrentUser`) o por importar `database/drizzle` sin mock (el
  módulo arroja en import si `DATABASE_URL` no está definido).
- [x] `tsconfig.json`: `ignoreDeprecations: "5.0"` para silenciar el
  aviso de `baseUrl` en TS 5.8.

Resultado: `nest build` verde, `ng build --configuration=production`
verde, `jest` 161/161.

## Sprint 23 — Streaming SSE del borrador IA (cerrado)

- [x] `RadiogenAIClient.iterChunks(request)` como primitiva
  asíncrona; `generate()` y `generateStream(request, onClose)` la
  envuelven (acumular vs. yield).
- [x] `AiDraftService.generateStream(reportStudyId, dto, user)` con
  el mismo gate que `generate` extraído en
  `assertCanGenerate()`. Auditoría se escribe al cerrar el generador
  (éxito o error) con `outcome` y char count realmente recibido.
- [x] `POST /v2/reports/:reportStudyId/ai-draft/stream` que
  pre-evalúa el gate (4xx/5xx normal si falla) y, en cuanto hay
  primer chunk, escribe los headers SSE y emite frames
  `event: chunk` + `event: done` (o `event: error`).
- [x] Front: `AiDraftService.generateStream` con `fetch +
  ReadableStream.getReader()` y SSE parser por frames. Editor
  inserta texto en vivo en la sección `Conclusion`, autosave al
  final, fallback al método no-stream si el operador apaga SSE.
- [x] Tests Jest: 5 nuevos en `radiogenai.client.spec` (chunking,
  cierre con summary, error mid-stream) y 3 en
  `ai-draft.service.spec` (gate antes de stream, auditoría con
  outcome=ok, auditoría con outcome=error).
- [x] `docs/AI-INTEGRATION.md` documenta el nuevo endpoint y el
  contrato de eventos.

## Sprint 24 — Migración PrimeNG → 19 + saneo del front (cerrado)

Sprint puente disparado al confirmar que `ng build` no había
producido nunca un bundle válido en este workspace: la instalación
real de `node_modules` traía PrimeNG 19.0.5 (la versión pinned en
`package.json` desde Sprint 0) pero el front estaba escrito contra
la API de PrimeNG 17/18.

- [x] `InputTextareaModule` → `InputTextarea` (standalone) en
  `report-editor.component.ts` (import + `imports[]`).
- [x] `severity="warning"` → `severity="warn"` en SLA dashboard y
  `stateSeverity()` del editor (PrimeNG 19 renombró el valor del
  union type).
- [x] `[value]="d.counts.X"` → `[value]="d.counts.X.toString()"` en
  SLA dashboard (el binding pide `string`, no `number`).
- [x] `onLazyLoad(event: { rows?: number })` → `rows?: number | null`
  en `WorklistComponent`, `AssignmentsComponent`, `AuditComponent`
  (PrimeNG 19 cambió `TableLazyLoadEvent.rows` para incluir `null`).
- [x] `DEFAULT_SECTIONS.CT` / `DEFAULT_SECTIONS.OTHER` → bracket
  access (TS 5 strict `noPropertyAccessFromIndexSignature`).
- [x] `token.interceptor.ts` `refreshedToken$.next(newToken)`:
  `string | undefined` → `string | null`.
- [x] `studies-pages.component.ts viewStudy()`: faltaba `await` en
  `getViewerUrl()` que devuelve `Promise<string>`; el `window.open`
  recibía la promesa cruda.
- [x] Tests realineados con el código actual: `token.interceptor.spec`
  esperaba `/user/login` (Sprint 20 lo cambió a `/login`).

Resultado: `ng build --configuration=production` verde, dist
generado, `jest` 124/124 (front) + 166/166 (back). El SPA por fin
arranca y los Sprints 21-23 (RadiogenAI integration + SSE) son
testeables en navegador.

## Sprint 25 — RLS efectivo + E2E con testcontainers (cerrado)

Último Sprint 7 leftover real. La infra ya existía desde Sprint 7
(migración `infra/migrations/001-enable-rls.sql`,
`RlsContextInterceptor` con auto-gating, runbook), pero faltaba
cobertura completa y verificación end-to-end.

- [x] Migración RLS extendida a `telerady.report`,
  `telerady.mwl_entry` y `telerady.hl7_message` (tablas tenant-scoped
  que estaban fuera de las primeras policies). Cada una con `USING`
  + `WITH CHECK` referenciando el helper `_current_hospital_ids()`
  con escape a `_is_privileged()`.
- [x] `RlsContextInterceptor` registrado como `APP_INTERCEPTOR`
  global. El propio interceptor se auto-desactiva cuando
  `RLS_ENABLED !== 'true'`, así que dev y los tests jest unitarios
  siguen inalterados.
- [x] E2E setup reescrito (`test/e2e/setup-db.ts`): el container
  ahora aplica el seed canónico **y** la migración RLS, provisiona
  un password para `telerady_app`, expone un factory
  `connectAsApp()` con un cliente autenticado bajo ese rol y
  preserva el `migratorClient` superuser para arrange/teardown.
  Tipos de Drizzle y `pg` saneados (`@types/pg` añadido).
- [x] E2E spec (`test/e2e/tenant-isolation.spec.ts`) reescrito para
  cubrir seis escenarios contra el role RLS-forced:
    1) Sin ningún GUC: 0 filas (fail closed).
    2) GUC `app.current_hospital_ids = {A}`: sólo el estudio de A.
    3) GUC `app.is_privileged = true`: ambos estudios.
    4) `WITH CHECK` bloquea un INSERT cross-tenant
       (`row-level security` en el mensaje del error).
    5) `audit_log` SELECT respeta el filtro de hospital.
    6) `hospital_membership` sólo expone la fila del usuario actual.
  Helper `withTenant(client, guc, fn)` envuelve cada test en una
  transacción y ejecuta los cuatro `set_config(...)` que el
  interceptor hace en producción.
- [x] `RLS-ACTIVATION-RUNBOOK.md`: rollback ampliado a todas las
  tablas, sección "Day-2 operations" apunta al spec real
  (`test/e2e/tenant-isolation.spec.ts` con `E2E=1`) y se documenta
  el wiring global del interceptor.

Gating: los E2E necesitan Docker (testcontainers). `npm test` sigue
no tocándolos (`it.skip` sin `E2E=1`). Build, type-check y suite
estándar siguen 39/39, 166/166 verdes.

## Sprint 26 — Release engineering: Dockerfiles + CI hardening (cerrado)

Sin imágenes Docker, todo el código bonito de Sprints 21-25 no se
entrega reproducible. Y el CI lanzaba `npm test` pero nunca corría
el suite E2E que escribimos en Sprint 25. Cerrado:

- [x] `apps/back/Dockerfile` multi-stage (deps → build → prune →
  runtime). Runtime Node 22 alpine, UID 1001 no-root, sólo
  `dist/` + `node_modules` de producción, ~180 MB. HEALTHCHECK
  apunta a `/healthz`.
- [x] `/healthz` añadido a `AppController` (fuera del prefix `/v1`
  para que las probes no rompan al subir versión). Spec del
  controller cubre la respuesta.
- [x] `apps/front/Dockerfile` multi-stage (deps → build → runtime).
  Runtime nginx 1.27-alpine con `apps/front/nginx.conf` (SPA
  fallback, gzip selectivo, headers de seguridad, cache
  inmutable para fingerprinted assets, `/healthz` flat 200).
  Listens 8080 para correr como `nginx` user.
- [x] `.dockerignore` en ambos: fuera `node_modules`, `dist`,
  `.env`, `coverage`, `.git`, fixtures.
- [x] `.github/workflows/ci.yml`:
    - Nuevo job `back-e2e` que corre la suite Sprint 25 con
      `E2E=1` contra el Docker daemon que `ubuntu-latest` ya
      provee (testcontainers se encarga de Postgres). Depende
      de `back` para no malgastar minutos si el unit suite falla.
    - Nuevo job `docker-images` que construye ambas imágenes
      con `docker/build-push-action@v6` y caché GHA (no push:
      solo verifica que los Dockerfiles compilan en cada PR).

Verificación: nest build green, jest 167/167 (was 166 + 1 nuevo
healthz spec), ng build --configuration=production green. Los E2E
siguen gated en `E2E=1` para los devs locales; en CI corren contra
el daemon real.

## Sprint 27 — DICOM MPPS receiver (cerrado)

Cubre Modality Performed Procedure Step: las modalidades emiten
N-CREATE cuando arrancan el procedimiento y N-SET cuando lo
terminan. Un Lua script en Orthanc parsea los DICOM y los reenvía
al back vía webhook.

- [x] Tabla `telerady.mpps_event` (id, performed_procedure_step_id,
  accession_number, study_iuid, status, modality, station_name,
  hospital_id, mwl_entry_id, report_study_id, started_at, ended_at,
  raw_payload_enc, received_at, processed_at, error). Índices sobre
  pps_id, accession_number y study_iuid.
- [x] Esquema Drizzle (`mppsEventInTelerady`) y DDL appendeado a
  `db-seed.sql`.
- [x] `ApiKeyGuard` reusable en `src/common/auth/`: lee
  `INTEGRATION_API_KEY` del env, compara con `timingSafeEqual`,
  fail-closed si la env no está (503).
- [x] `MppsService.ingest(dto)` en una sola transacción:
    1) Busca el `mwl_entry` por accessionNumber (si viene).
    2) Busca el `report_study` por studyInstanceUid (si viene).
    3) Upsert del evento por `performed_procedure_step_id` (mismo
       PPS = misma fila; N-SET actualiza N-CREATE).
    4) Avanza `mwl_entry.state` mirroreando el status MPPS, sin
       retroceder desde `completed`.
    5) Audit `pacs.mpps_received` + métrica
       `telerady_mpps_events_total{status}`.
- [x] `POST /v1/integrations/orthanc/mpps` protegido por
  `ApiKeyGuard`. DTO valida estados (`IN PROGRESS | COMPLETED |
  DISCONTINUED`), longitudes y formato ISO8601.
- [x] Env: `INTEGRATION_API_KEY` (≥32 chars, opcional para dev;
  endpoint responde 503 si falta).
- [x] Tests: 5 en `mpps.service.spec` (caso sin matches, join MWL,
  join report_study, upsert por PPS id, métrica labelada por
  status) + 5 en `api-key.guard.spec` (503 sin env, sin header,
  key incorrecta, longitud distinta, OK).

Resultado: nest build green, jest 177/177 (41 suites). No requiere
front (es webhook server-to-server desde Orthanc al back).

## Sprint 28 — Provider abstraction + Ollama local (cerrado)

RadiogenAI deja de ser el único proveedor. Refactor + segunda impl:

- [x] Interface `AiDraftProvider` con tipos compartidos
  (`AiDraftRequest`, `AiDraftResult`, `AiDraftStreamChunk`,
  `AiDraftStreamSummary`) y token DI `AI_DRAFT_PROVIDER` en
  `src/integrations/ai/ai-draft.provider.ts`. Misma surface que el
  cliente antiguo: `configured`, `generate(req)`, `generateStream(req,
  onClose)`.
- [x] `RadiogenAIProvider` (renombrado desde `RadiogenAIClient`,
  movido a `src/integrations/ai/providers/`). Comportamiento
  idéntico: `x-api-key`, SSE `data:` parser, timeout.
- [x] `OllamaProvider` nueva, habla `/api/generate` NDJSON.
  System prompt bilingüe (ES/EN), modelo configurable
  (`OLLAMA_MODEL`, default `llama3.1:8b-instruct`), timeout
  separado (default 120 s — los modelos locales son más lentos).
- [x] `AiModule` con `useFactory` que selecciona impl según
  `AI_DRAFT_PROVIDER` env. Cualquier valor no reconocido devuelve
  un provider stub con `configured=false` así el endpoint
  responde 503.
- [x] `AiDraftService` ahora inyecta `@Inject(AI_DRAFT_PROVIDER)
  client: AiDraftProvider`. El audit log usa
  `client.providerName` para que las consultas RGPD del paciente
  puedan distinguir entre "este borrador se generó internamente"
  vs "este se envió a RadiogenAI".
- [x] Módulo legacy `src/integrations/radiogenai/` eliminado;
  imports actualizados.
- [x] Tests: 5 en `radiogenai.provider.spec`, 7 en
  `ollama.provider.spec` (configured flag, generate accumula
  NDJSON, streaming respeta fragmentos vacíos, mapeo 5xx, error
  inline, prompt bilingüe). `ai-draft.service.spec` actualizado al
  nuevo token DI.
- [x] `docs/AI-INTEGRATION.md` rewriteado con tabla de
  proveedores + procedimiento de switch en caliente.

Resultado: nest build green, jest 182/182 (42 suites).
Operativamente: cambiar `AI_DRAFT_PROVIDER=ollama` +
`OLLAMA_URL=…` y reiniciar el pod basta para sacar los datos del
encargado externo.

## Sprint 29 — Web Push backend (RFC 8292 VAPID) (cerrado)

Primera pieza para que la PWA / app móvil futura pueda recibir
alertas urgentes sin polling. La SPA se suscribe con el Service
Worker, el back guarda la suscripción y envía notificaciones
firmadas con VAPID.

- [x] Tabla `telerady.push_subscription` (`user_id`, `endpoint`
  UNIQUE, `p256dh`, `auth`, `user_agent`, `created_at`,
  `revoked_at`). Índice parcial sobre `user_id WHERE revoked_at
  IS NULL` para que el lookup en el send sea O(devices).
- [x] Esquema Drizzle + DDL appendeado a `db-seed.sql`.
- [x] Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (validados). Sin las dos primeras, el
  `PushService` reporta `configured=false`, los endpoints
  responden 503 y los sends son no-ops (fail-closed).
- [x] `PushService` (con `web-push` lib):
    - `subscribe(userId, dto)` upsertea por endpoint (idempotente:
      el navegador puede re-suscribirse y nosotros refrescamos las
      keys + `revoked_at = NULL`).
    - `unsubscribe(userId, id)` soft-delete.
    - `sendToUser(userId, payload)` reúne las subs activas, envía
      vía web-push con TTL 600 s, marca como revoked las que
      respondan 404/410 (push service forgot them), y devuelve
      `{ delivered, reaped, failed }`.
    - Audit `push.notification_sent` con
      `{ category, devices, delivered, reaped, failed }` —
      `title` / `body` NUNCA en el audit (pueden llevar la
      descripción del estudio que tratamos como PHI-adjacent).
- [x] Métricas Prometheus
  `telerady_push_notifications_total{category,outcome}` con
  outcomes `delivered|reaped|failed`.
- [x] Endpoints:
    - `GET /v1/push/public-key` (público, devuelve la VAPID
      public para que el SW llame a `PushManager.subscribe()`).
    - `POST /v1/me/push/subscriptions` (JWT, idempotente).
    - `DELETE /v1/me/push/subscriptions/:id` (JWT).
- [x] Tests: 5 (no configurado→noop, init web-push, upsert por
  endpoint, send con 410-gone reaping + audit sin PHI, 5xx
  counted as failed sin revocar).

Wiring del consumer queda fuera del alcance: cuando llega un
estudio urgente o la asignación cambia, basta con un
`pushService.sendToUser(actor.id, { title, body, category })`
desde el lugar que ya emite la audit row correspondiente. La
infra está lista y testeada.

Resultado: nest build green, jest 187/187 (43 suites, +5 from
Sprint 28's 182).

## Sprint 30 — Wire PushService + SPA Service Worker (cerrado)

Cierra el loop end-to-end: el back ya envía pushes cuando ocurre
algo relevante, y la SPA tiene cómo suscribirse al sistema.

- [x] **Back wiring** (best-effort, fire-and-forget — un push
  caído nunca aborta la transacción que lo originó):
    - `admin.assignStudy()` → `push.sendToProfessional()` con
      categoría `study_assigned` y deep-link
      `/radiologist/study/:id`.
    - `pacs-ingest.sync()` cuando el `WorkflowEngine` auto-asigna
      → push categoría `study_ingested` (texto incluye la
      modalidad).
- [x] `PushService.sendToProfessional(professionalId, payload)`
  resuelve `app_user.professional_id` y delega a `sendToUser`.
- [x] **SPA Service Worker** (`apps/front/src/sw.js`) minimal:
  handler `push`, `notificationclick` que reusa una pestaña
  existente si la hay (mejor UX). Sin caching agresivo —
  contexto clínico, no queremos lecturas stale.
- [x] `angular.json` empaqueta `sw.js` en el root del bundle.
- [x] `PushSubscriptionService` Angular: signals
  `supported`/`permission`/`enabled`/`subscriptionId`,
  `enable()` (pide permiso, registra SW, llama
  `/v1/push/public-key`, suscribe vía PushManager y POSTea al
  back), `disable()` (DELETE en el back + `unsubscribe()`
  local). Convierte base64url → Uint8Array para
  `applicationServerKey`.
- [x] UI en `/admin/me`: card "Push notifications" con estado
  del permiso, botón activar/desactivar, hint cuando el
  navegador tiene Telerady en deny.
- [x] Tests: 2 en `admin.service.spec` (assign dispatch push,
  fallo de push no aborta assign).

Resultado: back nest build green, jest 189/189 (44 suites,
+2). Front ng build prod green, jest 124/124. La operativa
real ya tiene push: cuando un admin reasigna un estudio, el
nuevo primario lo nota en su navegador / móvil al instante.

## Sprint 31 — VllmProvider (OpenAI-compatible) (cerrado)

Tercer provider IA: vLLM, TGI o llama.cpp `server` en el
perímetro del operador, hablando el mismo contrato OpenAI Chat
Completions con SSE.

- [x] `VllmProvider` implementa `AiDraftProvider`. POST a
  `/v1/chat/completions` con `stream:true`, parsea las líneas
  `data: {choices:[{delta:{content}}]}` y termina al ver
  `data: [DONE]`. Authorization Bearer opcional
  (`VLLM_API_KEY`).
- [x] Factory en `ai.module.ts` ahora maneja `vllm` como tercera
  opción de `AI_DRAFT_PROVIDER`.
- [x] Env: `VLLM_URL`, `VLLM_API_KEY` (opcional), `VLLM_MODEL`,
  `VLLM_TIMEOUT_MS`. Validados por `env.schema.ts`.
- [x] Tests (7): providerName/configured flag, 503 sin config,
  hit a `/v1/chat/completions` con stream y modelo correctos,
  Bearer condicional, streaming fragmentos ordenados, 5xx
  mapping, error inline `{"error":{"message":…}}`.
- [x] `docs/AI-INTEGRATION.md` tabla extendida con la tercera
  fila (mismo nivel de privacidad que Ollama; data nunca sale
  del perímetro).

Resultado: nest build green, jest 196/196 (45 suites, +7).
Backlog IA cerrado: SaaS + dos runtimes locales con dos
contratos diferentes ya cubren todos los casos típicos.

## Sprint 32 — Hot-path indexes (cerrado)

Auditoría de las queries más calientes y añadidos los índices
que faltaban. Todo `IF NOT EXISTS`, idempotente.

- `report_study_worklist_idx`
  ON `(hospital_id, report_state_id, study_created_time DESC)`
  — composite que el worklist usa en todos los renders.
- `report_study_professional_idx` ON `professional_id` —
  drives el DICOM export + "asignados a mí".
- `report_study_study_iuid_idx` ON `study_iuid` — lookup en
  PacsIngest antes de upsert (antes era seq scan).
- `report_professional_idx` ON `report.professional_id`.
- `report_signed_at_idx` (parcial, WHERE signed_at IS NOT NULL)
  — alimenta el SLA dashboard sin cargar las filas sin firmar.
- `audit_log_action_idx` ON `audit_log.action` — admin verb filter.
- `event_log_professional_type_idx`
  ON `(professional_id, event_type, created_at)` — composite
  del query natural per-professional.

Entregables:
- [x] DDL appendeado a `db-seed.sql` (sin CONCURRENTLY, IF NOT EXISTS).
- [x] Migración separada
  `infra/migrations/002-hot-path-indexes.sql` con
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS` para producción
  (no bloquea writes; documentado que CONCURRENTLY no puede ir
  en transacción).

Resultado: jest sigue 196/196 (sólo DDL). El operator aplica
`psql -f infra/migrations/002-hot-path-indexes.sql` en
producción sin downtime.

## Sprint 33 — Grafana dashboards + Prometheus alerts (cerrado)

Métricas expuestas pero solo había un dashboard de logs. Esta
sprint añade:

- `infra/observability/grafana/dashboards/telerady-metrics.json`
  con 12 paneles (HTTP rate/p95, reports signed/sent, SLA pending
  con thresholds, AI draft rate + latency p50/p95/p99, MPPS,
  push, errors).
- `infra/observability/telerady-alerts.yml` con 7 reglas
  recomendadas; `prometheus.yml` las carga vía `rule_files:`.

## Sprint 34 — Security review pass (cerrado)

OWASP API Top 10 walk-through, dos fixes low:

- MFA confirm con `@Throttle({ limit: 10, ttl: 60_000 })` para
  cerrar el brute-force window del TOTP de 6 dígitos.
- `/v1/me/data-export` y `/v1/me/dicom-export` con
  `@Throttle({ limit: 5, ttl: 3_600_000 })` — RGPD exports
  pesados, fácil DoS de bolsillo.
- Inventario completo de controles + residual risks en
  `docs/SECURITY-FINDINGS-SPRINT34.md`.

## Sprint 35 — HL7 priority propagation + study.urgent push (cerrado)

Cierra el wire-in del PushService al evento "estudio urgente":

- `mwl_entry` y `report_study` ganan columna `priority`
  (ROUTINE | URGENT | STAT). `report_study` además gana
  `accession_number` (la clave de join entre MWL y DICOM).
  DDL idempotente en `db-seed.sql` + migración separada
  `infra/migrations/003-priority-propagation.sql` con
  `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
- `hl7-mapper.ts` extrae el priority code de
  `OBR-27.6 → ORC-7.6 → OBR-5` (en ese orden) y lo normaliza:
  `S → STAT`, `A/T/P → URGENT`, resto → `ROUTINE`. Spec
  cubre los 9 casos.
- `MllpServer.upsertMwlEntry()` persiste la prioridad junto
  con el resto del ORM.
- `PacsIngestService.sync()`:
    - Extrae `AccessionNumber` del estudio DICOM.
    - Hace lookup de `mwl_entry` por accession para heredar
      prioridad; si la modalidad-walk-in no tiene MWL, se
      queda ROUTINE.
    - Persiste `accession_number` + `priority` en
      `report_study`.
    - Cuando emite push, si la prioridad es STAT/URGENT cambia
      el `title` ("Estudio STAT"/"Estudio URGENT"), el
      `body` ("Atender ahora") y la `category` a
      `study_urgent` con un tag distinto para que el SW no
      deduplique con notificaciones de routine.

Resultado: nest build green, jest 205/205 (46 suites,
+9 mapper tests).

## Sprint 36 — OpenAPI export al repo (cerrado)

- `apps/back/scripts/export-openapi.ts` con dummies de env →
  Nest build sin DB → `docs/openapi.json` 77 KB.
- npm script `export:openapi`.
- Fix lateral: JobsModule no importaba Hl7v2Module → DI runtime
  fail oculto que sólo se manifestaba al construir el grafo.

## Sprint 37 — README badges + CI OpenAPI drift check (cerrado)

- Cinco badges (CI, license, Node 22, Nest 11, Angular 19, PG 16).
- Sección "OpenAPI" con el regenerate command.
- CI job back: `npm run export:openapi` + `git diff --quiet`.
  PR que mueva un controller sin regenerar el snapshot falla con
  mensaje claro.

## Sprint 38 — Web App Manifest (cerrado)

- `apps/front/src/manifest.webmanifest` con name / start_url /
  display=standalone / theme_color / dos shortcuts (Worklist + Mi
  cuenta) accesibles desde long-press del icono.
- `index.html` con `<link rel="manifest">` + theme-color.
- angular.json emite el manifest al bundle root junto a sw.js.
- Icon pendiente: PNG set (192/512/maskable) cuando exista
  artwork real; el manifest pasa Lighthouse short of icons.

## Sprint 39 — Jest coverage thresholds (cerrado)

- `coveragePathIgnorePatterns` excluye módulos / DTOs / scripts /
  schema.ts (signal noise).
- Thresholds anti-regresión (justo por debajo del baseline):
    statements 30 (baseline 38.20%)
    branches   25 (baseline 29.19%)
    functions  30 (baseline 36.58%)
    lines      30 (baseline 38.47%)

## Sprint 40 — Cover MfaService + NotificationsService (cerrado)

- 7 tests del MFA (setup encrypt secret, confirm valid/invalid,
  verifyForLogin, disable).
- 5 tests del webhook signer (HMAC, retries, secret no
  configurado).
- Coverage statements 38.20 → 40.08, branches 29.19 → 30.21.

## Sprint 41 — Fix hl7-codec parseHl7 MSH off-by-one (cerrado)

Bug encontrado al escribir el spec del codec: `getField(msh, 3)`
devolvía MSH-4 en vez de MSH-3. Producción enviaba ACKs con
sender/receiver flipped y guardaba el sender app incorrecto en
`mwl_entry`. Reescrito el branch MSH del parser para que el
indexing coincida con HL7 §2.7 en todos los segmentos.

## Sprint 42 — Cover MeService (cerrado)

- 4 tests de los endpoints RGPD: export con/sin professional,
  setProcessingRestriction, deleteAccount (tombstone + redact +
  audit dentro de la tx).
- Coverage 40.08 → 42.57 statements / 32.93 branches.

## Sprint 43 — DR ops: audit-verify.sh + CI backup/restore (cerrado)

- `scripts/audit-verify.sh` que llama a `POST
  /v1/admin/audit/verify` con jq + PagerDuty-friendly exit codes.
- Workflow `backup-restore.yml`: dos postgres services, GPG
  encrypt/decrypt, pg_dump | pg_restore, row-count parity
  check. PR-triggered + cron semanal.

## Sprint 44 — THREAT-MODEL refresh (cerrado)

- OWASP API Top 10 actualizado a Sprint 41.
- Nueva sección "Cambios desde Sprint 0" con timeline.
- Nueva sección "Invariantes que NUNCA deben romperse"
  (header vs cookie, PII never leaves the back, audit in tx,
  RLS_ENABLED+telerady_app).

## Sprint 45 — ARCHITECTURE refresh (cerrado)

Diagrama de componentes con PWA + SW + push + HL7 MLLP + MPPS
webhook + AI provider abstraction. Nuevas §9 (AI provider) y
§10 (Notificaciones push) con detalle operativo.

## Sprint 46 — env.schema spec extended (cerrado)

7 tests nuevos: AI_DRAFT_PROVIDER default + invalid value +
OLLAMA_URL validation, INTEGRATION_API_KEY length, VAPID_SUBJECT
mailto/https format, VAPID keys opcionales.

## Sprint 47 — PushService.sendToProfessional spec (cerrado)

2 tests del helper de Sprint 30: resolución professional →
user, no-op cuando no hay app_user mapping. Drizzle mock
extendido con thenable en `.where()`.

## Sprint 48 — WorkflowEngine spec (cerrado)

8 tests del decision engine: sin reglas, prioridad ascendente,
modality filter, subspecialty match, requiresReview surfacing,
applyToStudy con/sin match.

## Sprint 49 — Front PushSubscriptionService spec (cerrado)

4 tests: supported=false en jsdom, enable() bail-out, disable()
DELETE con id, disable() no-op sin id.

## Sprint 50 — Front AiDraftService spec (cerrado)

6 tests: generate() POST, url-encode, generateStream() 403
decorate, SSE chunk routing, error frame routing, Bearer +
Accept headers. Duck-types ReadableStream para jsdom.

## Sprint 55 — Cover PdfService (cerrado)

`pdf.service.spec.ts` (5 tests) ejecuta el `PdfService` real con
`pdfkit` y un `StorageService` mock:

- Render normal: bucket=`reports`, key=`reports/<study>/v<n>.pdf`,
  contentType=`application/pdf`, metadata `{reportId, version}`,
  body es un Buffer con magic-bytes `%PDF`.
- Contents sin secciones → fallback "(Informe vacío)" sin
  petar.
- `signatureData=null` → sin bloque de firma.
- `policy='drawn_hash_tsa'` con `tsa` → footer TSA presente.
- `policy='name_collegiate'` produce un PDF **estrictamente más
  corto** que el equivalente `drawn_hash_tsa` (no podemos grepear
  el texto: pdfkit escribe deflate streams; comparamos tamaños).

Coverage back 44.92 → 46.44 statements, 35.30 → 35.81 branches.
PdfService 100% statements / branches / functions / lines. Total
259 → 264 tests.

## Sprint 54 — Cover TsaService + SignatureService (cerrado)

Dos suites nuevas en `apps/back/src/reports/v2/`:

- `tsa.service.spec.ts` (5 tests): hash sha256 estable
  para `string` y `Buffer` con el mismo plaintext; ts en ISO 8601;
  token = `sha256(provider|hash|ts)` (recomputado por el test);
  token rota entre llamadas con el mismo payload por avance de
  reloj.
- `signature.service.spec.ts` (6 tests): rechazo de policy
  cruzada vs hospitalPolicy; rechazo si professional no tiene
  name+collegiate y el DTO no los override; happy-path
  `name_collegiate` con `contentsDigest` (sha256 de los
  contents); override desde DTO; rechazo `drawn_hash_tsa` sin
  payload `drawn`; happy-path drawn que sube PNG vía
  `storage.put`, llama `tsa.stamp` y devuelve `signatureData`
  con `drawingBucket/Key`, `tsa.token` y `signedAt` heredado del
  stamp. `database/drizzle` mockeado para que el módulo cargue
  sin DATABASE_URL.

Coverage backend 43.55 → 44.92 statements; 33.95 → 35.30
branches. Ambos services bajo prueba pasan a 100% statements.

## Sprint 53 — Dev seed `seed:push` (cerrado)

`apps/back/src/scripts/seed-push.ts` monta una `push_subscription`
falsa contra el usuario que se le pase por `--email` (default
`pepa@telerady.test`, creado por `seed:demo`) para poder ejercitar
`PushService.sendToUser` sin un navegador real:

- `endpoint`: `https://push.example.invalid/wp/dummy-<userId>`. El
  TLD `.invalid` (RFC 2606) garantiza ENOTFOUND → `failed: 1` en
  cada envío, sin tráfico saliente real.
- `p256dh`: clave pública P-256 generada con `node:crypto`
  (`createECDH('prime256v1')`) y exportada en base64url, en el
  formato exacto que `web-push` espera para no rechazar la cifra
  ECDH del payload antes de la entrega.
- `auth`: 16 bytes random base64url-encoded (el formato Chrome).
- Upsert por `endpoint` (mismo conflict target que
  `PushService.subscribe`) → re-ejecutar el seed resucita +
  refresca, no duplica.

`npm run seed:push` desde `apps/back`, o `make seed-push` desde
la raíz. Help actualizado en el Makefile.

## Sprint 52 — Vercel deploy del front + fix NG8107 (cerrado)

- `vercel.json` en la raíz del monorepo:
    - `buildCommand` instala deps con `npm ci` dentro de
      `apps/front` y corre `ng build` production.
    - `outputDirectory` apunta a
      `apps/front/dist/telerady-front/browser` (Angular 19 con
      output `application` mete el bundle en `browser/`).
    - `rewrites` SPA-fallback (`/(.*) → /index.html`) para que
      las rutas de Angular Router carguen al refrescar.
    - `headers`: las mismas de seguridad que el nginx.conf
      (X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
      Permissions-Policy) + cache `no-store` para `index.html` y
      `max-age=31536000 immutable` para los assets fingerprinted.
- README §Deploy: importar en Vercel y back NO va en Vercel
  (usar Dockerfile + Fly/Render/k8s).
- Fix lateral: warning Angular NG8107 en
  `study-viewer.component.ts:51` (`modalities?.join` con tipo
  `string[]` no-nullable) → reemplazado por
  `modalities.length ? modalities.join(', ') : '—'`. Build limpio.

## Backlog y futuro

- PNG icon set (192/512/maskable) para que Chrome ofrezca
  "Install Telerady" automáticamente.
- i18n del front (ES por defecto, EN para integración
  internacional).
- Probar el flujo full E2E (login → ingest → assign → push →
  open editor → AI draft → sign → send) en un staging con
  containers reales.
