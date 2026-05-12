# Hallazgos de seguridad — Sprint 0

Lista de incidencias identificadas durante el hardening inicial. Algunas
están resueltas en código; otras requieren acción operativa fuera del repo.

## 1. Tokens productivos hardcodeados en el front (CRÍTICO)

> **Decisión de producto (post-Sprint 0):** ActualPacs queda **fuera de la
> arquitectura**. La plataforma será autónoma sobre Orthanc + OHIF propios.
> El token de ActualPacs debe revocarse de todas formas para cerrar la
> exposición del secreto, aunque la integración ya no se vaya a usar.

Al inspeccionar `apps/front/src` encontramos secretos productivos commiteados
al repositorio legacy:

| Archivo (legacy) | Secreto |
|---|---|
| `apps/front/src/app/service/report.service.ts` | `apiKey = 'rdg_RFO17C4DEZTBCNPXG5H4ZPWIJW0S05VKWUYD0JIQ1hqh0c'` (radiogenia) |
| `apps/front/src/environments/environment.ts` | `apiActualPacsToken: 'c18ebd3631cfcd356786b1e5e2b2d6458efb4119'` |
| `apps/front/src/environments/environment.dev.ts` | (mismo) |
| `apps/front/src/environments/environment.prod.ts` | (mismo) |

**Acción inmediata requerida** (fuera del repo):
1. **Revocar** el token de radiogenia y el de ActualPacs en sus respectivos
   proveedores. Asumir que ambos están comprometidos.
2. **Auditar** registros de uso de ambos servicios para detectar actividad
   anómala desde que se commitearon.
3. **Reescribir el historial git** sólo si el repo es privado y el equipo
   está conforme con el coste; si es público o ya fue clonado por terceros,
   asumir la fuga y rotar es la única defensa.

**Mitigación en código** (Sprint 0):
- `report.service.ts` eliminado.
- Tokens removidos de los tres `environment.*.ts`.
- Configuración añadida para que el back valide `JWT_ACCESS_SECRET` y otros
  secretos al boot vía Zod (rechaza el arranque si están vacíos o débiles).
- Pre-commit y CI con `gitleaks` añadidos para detectar nuevas fugas
  automáticamente.

## 2. Hashing de passwords por implementar (alta)

El back actualmente no expone endpoint de login (probablemente delegado a
otra app). Cuando el módulo de auth se implemente en Sprint 1, debe usar
**argon2id** con los parámetros OWASP 2024 (memoryCost 64 MiB, timeCost 3,
parallelism 4). La utilidad `Argon2Service` ya está disponible.

## 3. Cifrado por columna activado en Sprint 1 (alta)

El esquema actual guarda en claro: `pat_name`, `pat_birthdate`, `pat_id`,
`phone`, `email`, `bank_account`. La utilidad `AesGcmService` está lista; la
migración del esquema y de los repositorios se hace en Sprint 1, una vez
exista el modelo multi-tenant final.

## 4. JWT en localStorage (alta — front)

`apps/front/src/app/service/token.service.ts` lee/escribe los tokens en
`localStorage`. Vulnerable a XSS. Plan en `docs/FRONT-MIGRATION.md`:
backend establece el refresh en httpOnly cookie y el access se mantiene en
memoria del SPA. Se aplica en Sprint 1 con el rediseño del auth.

## 5. CORS abierto (resuelto en Sprint 0)

`origin: '*'` reemplazado por allowlist controlada vía `CORS_ORIGINS`.

## 6. Guards comentados (resuelto en Sprint 0)

`@UseGuards(AuthGuard('jwt'))` reactivado en `ReportController` y
`UserEventsController`.

## 7. Drive query injection (resuelto en Sprint 0)

Reemplazo de la interpolación de cadenas en `q:` por `escapeDriveLiteral`.
Aunque el módulo Drive desaparece en Sprint 2 al migrar a S3, mientras tanto
no es explotable por usuarios autenticados.

## 8. Trackers de terceros sin consentimiento (resuelto en Sprint 0)

`index.html` cargaba Google Tag Manager, Hotjar y Meta Pixel
incondicionalmente. Retirados. Reintroducción contemplada en Sprint 6
sujeta a un banner de consentimiento conforme AEPD.

## 9. CryptoJS AES ECB con secreto compartido (resuelto en Sprint 0)

Utilidad eliminada. Sustituida por AES-256-GCM con IV de 96 bits por
operación y master key validada de 32 bytes.

## 10. AI radiogenia / superficie de ataque (resuelto en Sprint 0)

Módulo `ReportService` del front y referencias en componentes eliminados.
La integración SSE con el proveedor externo se reintroducirá — si procede —
tras un análisis de DPIA actualizado.

## 11. Esquema multi-tenant pendiente (Sprint 1)

Sin `hospital_id` en muchas tablas, no es posible aislar tenants a nivel BD.
Se aborda en el rediseño del modelo de datos del Sprint 1, incluyendo RLS
Postgres y tests de aislamiento.

## 12. Service Account de Google con permisos amplios (Sprint 2)

`GOOGLE_PRIVATE_KEY` da acceso a `drive` y `spreadsheets` completos. Al
migrar documentos a S3 (Sprint 2), revocar la service account y eliminar el
módulo `integrations/google`.
