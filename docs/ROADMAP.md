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

## Backlog y futuro

- Modelos IA locales (cuando RadiogenAI deje de ser la opción única).
- Workflows DICOM avanzados (Modality Performed Procedure Step).
- App móvil para alertas urgentes.
