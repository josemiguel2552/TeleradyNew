# Threat Model — Telerady

Modelo STRIDE aplicado a la plataforma. Actualizar tras cada sprint mayor.

## Activos protegidos

| Activo | Sensibilidad | Notas |
|---|---|---|
| Estudios DICOM | Alta (datos especiales art. 9 RGPD) | Identificadores en tags |
| Informes clínicos | Alta | Diagnóstico = dato de salud |
| Datos personales del paciente | Alta | Nombre, fecha nac., ID |
| Credenciales profesionales | Media-alta | Colegiado, IBAN, DNI |
| Credenciales de sistema | Alta | Tokens JWT, claves API |
| Logs de auditoría | Alta | Integridad legal |
| Claves criptográficas | Crítica | KEK en Vault, DEKs derivados |

## Actores

- Atacante externo no autenticado
- Atacante externo con cuenta válida (insider de bajo privilegio)
- Empleado interno malicioso (radiólogo, hospital admin)
- Proveedor de hosting comprometido
- Atacante con acceso físico (red del hospital)

## Vectores STRIDE

### S — Spoofing
| Riesgo | Mitigación |
|---|---|
| Robo de JWT en localStorage | Tokens en httpOnly cookies con SameSite=Lax y Secure |
| Replay tras logout | Refresh tokens en BD con rotación y revocación |
| Suplantación de hospital al subir estudio | mTLS entre agente del hospital y backend |
| Phishing de radiólogo | MFA TOTP en login, alertas por dispositivo nuevo |

### T — Tampering
| Riesgo | Mitigación |
|---|---|
| Modificación de informe firmado | Hash chain + sello de tiempo TSA |
| Reescritura del log de auditoría | `audit_log` append-only + verificación periódica del chain |
| Modificación de DICOM en tránsito | TLS 1.3 + verificación de tags clave |
| SQL Injection | Drizzle ORM + nunca string concat; tests negativos |
| Drive query injection (legacy) | Escapar comillas hasta migrar a S3 |

### R — Repudio
| Riesgo | Mitigación |
|---|---|
| Radiólogo niega haber firmado | TSA cualificada + hash del PDF + log con IP/UA |
| Hospital niega haber recibido informe | Acuse vía evento firmado + email con DKIM |

### I — Information Disclosure
| Riesgo | Mitigación |
|---|---|
| Dump de BD revela PII | AES-256-GCM por columna (envelope) |
| Logs con `pat_name` o `pat_id` en claro | Redaction pino + pseudonimización HMAC |
| Tenant A ve datos de tenant B | RLS Postgres + tenant filter en repos + tests |
| Indexación de Swagger en internet | Swagger detrás de auth en prod |
| `bypassSecurityTrustHtml` en front | Eliminar; usar DOMPurify si hace falta HTML |
| OHIF leak vía PostMessage | Validar `event.origin` en handlers |

### D — Denial of Service
| Riesgo | Mitigación |
|---|---|
| Spam de logins | Throttler por IP y por email |
| Carga masiva de DICOM | Quotas por hospital + backpressure en BullMQ |
| Solicitudes pesadas a OHIF | Cache CDN, lazy load de series |

### E — Elevation of Privilege
| Riesgo | Mitigación |
|---|---|
| Radiólogo → admin por manipulación de claim | JWT firmado, validación de rol en cada guard |
| Hospital user → hospital admin | Tabla `user_role` separada del JWT; verificar en BD |
| Path traversal en uploads | Validación estricta de filename + UUID interno |
| Prototype pollution | Validación class-validator + lockfile auditado |

## Top 10 OWASP API Security — estado

| ID | Riesgo | Estado actual |
|---|---|---|
| API1 | BOLA | Sprint 7: `TenantScope` en todos los repos; Sprint 25: RLS forzado en Postgres con `telerady_app` (BYPASSRLS=off) |
| API2 | Broken Authentication | Sprint 0: JWT, refresh rotation, MFA stub; Sprint 34: MFA confirm throttled; lockout por usuario |
| API3 | BOPLA | DTOs con `whitelist: true, forbidNonWhitelisted: true` en main.ts ValidationPipe |
| API4 | Resource Consumption | ThrottlerGuard global; Sprint 34: throttles dedicados a MFA + RGPD exports |
| API5 | Broken Function Auth | CASL `AbilityFactory` + RolesGuard; cobertura ampliada en Sprint 22 |
| API6 | Sensitive Business Flows | Sprint 5: firma; Sprint 7: revisión; Sprint 21: AI draft con triple opt-in |
| API7 | SSRF | OrthancClient hace URL fija desde env; RadiogenAIClient idem |
| API8 | Security Misconfiguration | helmet + CSP estricto + HSTS preload + CORS allowlist + env Zod |
| API9 | Improper Inventory | gitleaks en CI; Sprint 36: `docs/openapi.json` + drift check |
| API10 | Unsafe API Consumption | Todos los clientes externos con AbortController + timeout; Sprint 23: error mid-stream surface |

## Cambios desde Sprint 0 (resumen por sprint)

| Sprint | Adición o cambio relevante para el modelo |
|---|---|
| 17 | `/metrics` Prometheus añade superficie nueva; protegida por basic-auth en prod |
| 21 | AI draft → RadiogenAI: nuevo "encargado de tratamiento" externo (RGPD art. 28). Triple opt-in (env + hospital flag + user consent) |
| 22 | Métricas inyectadas correctamente; fix latente CASL types |
| 25 | RLS forzado en Postgres; interceptor pushea GUCs por request; suite E2E con testcontainers |
| 27 | MPPS receiver: webhook server-to-server protegido con `ApiKeyGuard` + `timingSafeEqual` |
| 28 | AI provider abstraction: ahora Ollama / vLLM locales son opción → datos pueden no salir del perímetro |
| 29 | Web Push (VAPID): VAPID private key se queda en el back; payload audit log sin PHI |
| 34 | Security review pass; throttles añadidos; residual risks documentados |
| 35 | HL7 priority propagation (STAT/URGENT). Push categorías separadas |
| 41 | parseHl7 off-by-one fix; ACK respondía con sender/receiver incorrectos |

## Invariantes que NUNCA deben romperse

- El **JWT access** viaja en `Authorization: Bearer`. El **refresh** viaja en
  cookie `httpOnly + Secure + SameSite`. Mutaciones (`POST`, `PUT`, `DELETE`)
  usan el header, no la cookie → no hay surface CSRF mientras se respete esto.
- Los `pat_id` / `pat_name` / `pat_birthdate` salen del back **sólo** descifrados
  con el AAD `report_study:<professionalId>`. Ningún provider externo (Radiogen,
  Ollama, vLLM, push, mpps, oru) los recibe.
- El `audit_log` se escribe **dentro** de la transacción que origina el evento.
  El hash chain se verifica diariamente (`scripts/audit-verify.sh`).
- `RLS_ENABLED=true` en producción + role `telerady_app` (BYPASSRLS=off). Los
  scripts de admin / migración usan `telerady_migrator` (BYPASSRLS=on).

## Asunciones

- El proveedor cloud cumple ENS y firma DPA conforme art. 28 RGPD.
- HashiCorp Vault se opera con unseal multi-key.
- Backups cifrados se prueban al menos trimestralmente (DR drill —
  ahora también semanalmente vía `.github/workflows/backup-restore.yml`).
