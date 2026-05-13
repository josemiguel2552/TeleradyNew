# Security review — Sprint 34

A focused internal review of the platform's externally-reachable
surface. Approach: walk the OWASP API Security Top 10 and tick which
controls are in place; for each gap that mattered in this sprint,
land a fix in the same PR.

## Inventory of existing controls

| Concern | Where | Status |
|---|---|---|
| Authentication | `auth/jwt.strategy.ts`, `auth/v1/auth.service.ts` | ✅ JWT HS256, refresh in `httpOnly+Secure+SameSite=Strict` cookie, argon2 hashes |
| Account lockout | `auth.service.ts:107-122`, `auth.repository.ts` | ✅ `MAX_FAILED_ATTEMPTS` + `LOCK_MINUTES` rolling lock |
| MFA | `auth/v1/mfa.service.ts`, `app_user.mfa_secret_enc` | ✅ TOTP, secret cifrado at rest |
| RBAC + ABAC | `auth/abilities/ability.factory.ts`, `auth/roles.ts` | ✅ CASL + role guard |
| Tenant isolation | `common/tenant/tenant-scope.ts` + RLS migración Sprint 25 | ✅ App layer + RLS efectivo |
| Encryption at rest (PII) | `common/crypto/column-encryption.service.ts` | ✅ AES-GCM 256 + AAD por fila + pseudonym pepper |
| TLS / HSTS / CSP | `main.ts` con helmet, CSP estricto en prod | ✅ |
| CORS | `main.ts` allowlist desde env | ✅ |
| Throttling | `ThrottlerGuard` global + `@Throttle` por ruta | ⚠️ ver Findings |
| Audit log integrity | `common/audit/audit-log.service.ts` + hash chain | ✅ replay verify + admin endpoint |
| Outbound webhook auth | `notifications.service.ts` con HMAC-SHA256 | ✅ |
| Inbound integrations (MPPS) | `ApiKeyGuard` con `timingSafeEqual` | ✅ Sprint 27 |
| Push notifications | VAPID + audit sin PHI | ✅ Sprint 29 |
| Logs PII redaction | pino redact paths en `app.module.ts` | ✅ |

## Findings + fixes landed this sprint

### F1 — MFA confirm sin rate limit (low)

`POST /v1/auth/mfa/confirm` aceptaba un código TOTP de 6 dígitos sin
throttle más allá del global (120/min). Brute force sostenido →
~17 minutos a 1 req/s para barrer las 10^6 combinaciones.

**Fix**: `@Throttle({ limit: 10, ttl: 60_000 })` en
`mfaConfirm()`. Generoso para un usuario humano (1 typo por 6 s) y
hostil para todo lo demás. El TOTP rota cada 30 s y los códigos
sólo son válidos en ±1 ventana, así que el atacante hace una
décima parte del espacio cada minuto incluso si pudiera mandar al
límite.

### F2 — RGPD exports sin rate limit (low)

`GET /v1/me/data-export` (JSON, todos los datos del usuario) y
`GET /v1/me/dicom-export` (ZIP, todos los estudios del radiólogo)
sin throttle específico. El segundo en particular es pesado
(streamea binarios de S3) y fácil de armar como DoS-de-bolsillo.

**Fix**: `@Throttle({ limit: 5, ttl: 3_600_000 })` en ambos —
cinco al hora es generoso para alguien que necesite descargar su
historial, incompatible con martillazos.

## Non-findings (intencionales)

- **register-hospital** no tiene `@Throttle` extra porque ya está
  detrás de `@Roles(Role.Admin)`: para llegar al endpoint el
  atacante necesita un JWT de admin, momento en el cual el rate
  limit es ya el menor de sus problemas.
- **mfa/setup** no necesita throttle dedicado: genera un nuevo
  secret cada vez, el cliente lo escanea con su autenticador; un
  atacante que arme miles no obtiene nada útil.

## Sin cambio para la próxima

- **CSRF**: las llamadas mutantes salen como JSON con cookie de
  refresh pero el access token va en `Authorization`. Mientras el
  SPA no use la cookie para mutaciones (sólo para refresh), no hay
  superficie CSRF. Documentar este invariante en
  `THREAT-MODEL.md`.
- **Brute force distribuido del login**: el lockout va por
  usuario, no por IP. Si un atacante prueba 1 password contra
  10.000 cuentas (credential stuffing), no dispara ningún
  lockout. Necesitaría rate limit por IP en el front-of-edge
  (nginx). Documentado como tarea ops.
- **HSTS preload**: ya servimos `max-age=63072000;
  includeSubDomains; preload`; sólo falta inscribir el dominio en
  hstspreload.org cuando se decida el dominio definitivo.
