# Integración con RadiogenAI

La generación asistida de borradores de informe vive **fuera** de Telerady,
en una API externa propia de RadiogenAI con su propio rate limiting y
tracking de uso. Telerady la consume como un cliente más.

Este documento describe cómo está atada la integración, qué se envía y
qué no, y los controles que el operador / DPO / usuario pueden activar
para apagarla.

## Topología

```
SPA ────► /v2/reports/:id/ai-draft (Telerady API)
                │
                ├── valida JWT + rol radiologist
                ├── valida hospital.ai_drafting_allowed
                ├── valida app_user.ai_consent_at
                └── RadiogenAIClient
                        │
                        ▼
                   x-api-key
                  /genreport (RadiogenAI API externa)
```

La SPA **nunca** habla directamente con RadiogenAI. La API key vive en el
backend, en una variable de entorno (`RADIOGENAI_API_KEY`) que el operador
sirve desde Vault. Si la key se compromete, se rota y se reinicia el back;
ningún cambio en la SPA, ningún despliegue del front, ningún cliente
queda con la key vieja en su navegador.

## Qué se envía a RadiogenAI

| Campo | Origen | Por qué |
|---|---|---|
| `findings` | Lo que el radiólogo escribió en la sección "Hallazgos" del editor | Es el contexto que la IA necesita |
| `report_title` | Modalidad seleccionada en el editor (CT/RX/RM/US/OTHER) | Para que la IA escoja la plantilla adecuada |
| `language` | `RADIOGENAI_DEFAULT_LANGUAGE` o el override de la SPA | Idioma del borrador |

## Qué **no** se envía nunca

- `pat_id` / `pat_name` / `pat_birthdate` (campos cifrados en BD).
- Cualquier tag DICOM.
- Identificador del estudio (`StudyInstanceUID`) o del informe.
- Identificador del profesional o del hospital.
- Cualquier cosa cifrada por columna en `report_study` o `report`.

El `RadiogenAIClient` está aislado en `apps/back/src/integrations/radiogenai/`
y sólo recibe los tres campos de arriba como argumento. No tiene
inyectado el `ColumnEncryptionService` ni acceso a la BD, así que es
materialmente imposible que filtre datos personales aunque alguien
modifique el flujo.

## Controles disponibles

| Nivel | Cómo se activa | Cómo se desactiva |
|---|---|---|
| Plataforma | `RADIOGENAI_URL` + `RADIOGENAI_API_KEY` en env | Borrar las variables → `/ai-draft` responde 503 |
| Hospital | `UPDATE telerady.hospital SET ai_drafting_allowed = TRUE WHERE …` | UPDATE a FALSE → todos los radiólogos de ese hospital pierden el botón |
| Usuario | `PATCH /v1/me/processing-restriction` o falta de consentimiento | El radiólogo no acepta el banner → 403 cada vez que lo intenta |

## Auditoría

Cada llamada a `/v2/reports/:id/ai-draft` deja una entrada inmutable en
`telerady.audit_log` con `action = 'report.ai_draft_requested'`. El
payload contiene:

```json
{
  "language": "es",
  "findingsChars": 412,
  "responseChars": 1180,
  "latencyMs": 4321,
  "provider": "radiogenai"
}
```

Nunca el texto de los hallazgos ni el contenido del borrador. La métrica
Prometheus `telerady_ai_draft_requests_total{outcome="ok|error"}` y el
histograma `telerady_ai_draft_latency_seconds` se ven en Grafana
(*Telerady — API overview* → panel "AI draft").

## RGPD

La IA es un **encargado de tratamiento** adicional (art. 28 RGPD). Antes
de activar `RADIOGENAI_URL` en producción debe estar firmado el contrato
art. 28 con RadiogenAI y actualizada la cláusula informativa que el
hospital firma con Telerady.

El consentimiento del usuario individual (art. 6.1.a) se recaba con un
banner al primer uso y se persiste en `app_user.ai_consent_at`. La
retirada se hace en `/admin/me` ejerciendo el derecho de oposición
(`PATCH /v1/me/processing-restriction`) o pidiendo al admin que lo
revoque manualmente.

Si la IA se desactiva globalmente (`RADIOGENAI_URL` vacío) los registros
históricos en `audit_log` permanecen — RGPD art. 17.3.b — y nos
permiten responder a una solicitud de acceso del paciente con la
trazabilidad completa de qué borradores se generaron.

## Resiliencia

- Timeout configurable (`RADIOGENAI_TIMEOUT_MS`, por defecto 60 s).
- En caso de error 5xx el endpoint propaga 503 al cliente sin
  reintentar (lo hace explícito el operador).
- La métrica `telerady_ai_draft_latency_seconds` tiene buckets hasta
  80 s; latencias mayores aparecen en el overflow bucket y se ven en
  el dashboard de Grafana.
- La SPA muestra "AI integration disabled or upstream offline" cuando
  el back devuelve 503; el flujo de firma sigue funcionando sin IA.

## Streaming SSE (Sprint 23)

A partir de Sprint 23 hay una variante streaming del endpoint:

```
POST /v2/reports/:reportStudyId/ai-draft/stream
Accept: text/event-stream
Authorization: Bearer …
Body: { findings, reportTitle, language?, acceptConsent? }
```

El gate (configured / scope / hospital opt-in / consent) se evalúa
**antes** de flippear a SSE: si falla, la respuesta es un 4xx/5xx
JSON normal (Nest filter) y no se abre stream. Cuando el primer chunk
llega, el back manda los headers SSE y emite frames:

```
event: chunk
data: <texto>

event: chunk
data: <texto>

event: done
data: {}
```

Si el upstream falla a mitad de generación, el back emite
`event: error\ndata: {"status":..., "message":...}\n\n` y cierra. La
SPA siempre escribe la salida en la sección `Conclusion` (sin
sobrescribir lo que el radiólogo ya tenía: separador
`--- borrador IA ---`) y dispara autosave al final.

EventSource no permite cuerpo en la petición, así que la SPA consume
el stream con `fetch` + `body.getReader()` (ver
`apps/front/.../services/ai-draft.service.ts`). El método no-stream
sigue disponible y se usa como fallback si el operador desactiva la
SSE en el reverse proxy.

La auditoría se escribe **al cerrar el generador** (éxito o error) con
el outcome y el char count realmente recibido, así operations puede
diferenciar entre "el borrador completó" y "el upstream se cortó a
mitad".

## Cambios futuros

- **Modelos locales**: si en algún momento se decide alojar la IA
  en infraestructura propia, el cliente se sustituye sin tocar el
  resto del back; el contrato (`generate / generateStream`) queda
  igual.
