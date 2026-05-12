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
| API1 | BOLA | Pendiente: añadir `tenant_id` en todas las queries (Sprint 1) |
| API2 | Broken Authentication | Sprint 0: JWT v2, refresh rotation, MFA stub |
| API3 | BOPLA | Pendiente: DTOs estrictos con whitelist en class-validator |
| API4 | Resource Consumption | Sprint 0: Throttler básico; Sprint 7: quotas avanzadas |
| API5 | Broken Function Auth | Sprint 0: CASL + guards; Sprint 1: cobertura completa |
| API6 | Sensitive Business Flows | Sprint 5: firmar/enviar informe |
| API7 | SSRF | Validar URLs en config y proxies (Sprint 2 con OHIF) |
| API8 | Security Misconfiguration | Sprint 0: Helmet, CORS, Swagger guard, env Zod |
| API9 | Improper Inventory | Sprint 0: gitleaks; Sprint 8: ROPA |
| API10 | Unsafe API Consumption | Sprint 2: clientes con timeouts + retries acotados |

## Asunciones

- El proveedor cloud cumple ENS y firma DPA conforme art. 28 RGPD.
- HashiCorp Vault se opera con unseal multi-key.
- Backups cifrados se prueban al menos trimestralmente (DR drill).
