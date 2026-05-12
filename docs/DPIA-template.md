# DPIA — Evaluación de Impacto en Protección de Datos

> Plantilla guiada por la metodología de la AEPD (Guía práctica
> "Análisis de Riesgos y Evaluación de Impacto") y el considerando 84 RGPD.

## 1. Descripción del tratamiento

- **Nombre**: Telerady — Plataforma de teleradiología.
- **Responsable**: Telerady S.L. (en constitución).
- **DPO**: pendiente.
- **Finalidades**: prestación de servicios de teleradiología (informado
  remoto de estudios DICOM por radiólogos colaboradores).
- **Base jurídica**: art. 9.2.h RGPD; ejecución de contrato art. 6.1.b.
- **Categorías de datos**: identificativos, salud (art. 9), profesionales,
  económicos (IBAN).
- **Interesados**: pacientes de hospitales cliente, radiólogos, personal
  hospital, personal Telerady.
- **Encargados**: ver `docs/ROPA.md` sección B.
- **Volumen estimado**: 100.000 estudios/año (objetivo año 1).

## 2. Necesidad y proporcionalidad

- **Necesidad**: el modelo de negocio requiere acceso remoto a estudios.
  Sin él, los radiólogos no pueden informar.
- **Proporcionalidad**: se trata sólo lo necesario para el informe
  (estudio + identificación mínima del paciente). Datos no clínicos
  (financieros del hospital, marketing) quedan fuera.
- **Minimización**: `pat_id` se pseudonimiza al loggear; sólo el
  radiólogo asignado puede ver el contenido en claro. La firma digital
  no incluye datos del paciente.

## 3. Riesgos

Escala: P (probabilidad) × I (impacto), 1-4 cada uno.

| Riesgo | P | I | P×I | Mitigación principal | Riesgo residual |
|---|---|---|---|---|---|
| Acceso indebido a estudios (otro tenant) | 3 | 4 | 12 | TenantScope + RLS + audit | 3 |
| Pérdida de claves de cifrado | 1 | 4 | 4 | Vault HA + rotación + backup of keys offline | 2 |
| Fuga de dump de BD | 2 | 4 | 8 | AES-256-GCM por columna + envelope encryption | 4 |
| Phishing a radiólogo / robo de sesión | 3 | 3 | 9 | MFA TOTP + JWT 15min + refresh httpOnly + lockout | 4 |
| Modificación de informe firmado | 1 | 4 | 4 | Hash chain audit + TSA eIDAS + PDF/A | 1 |
| DoS al PACS proxy | 3 | 2 | 6 | Throttler + WAF en producción | 3 |
| Subida de DICOM con malware o JPEG-embedded | 2 | 3 | 6 | Validación MIME + antimalware en agente (pendiente) | 4 |
| Empleado interno cambia datos | 1 | 3 | 3 | Acción audit_log + roles segregados | 2 |
| Borrado accidental por bug | 2 | 3 | 6 | Soft-delete + DR drill trimestral | 3 |
| Caída del proveedor IaaS | 2 | 3 | 6 | Backups off-site + multi-AZ + DR runbook | 3 |
| Pérdida de móvil con TOTP | 3 | 2 | 6 | Códigos de recuperación + reset por admin | 2 |

## 4. Medidas adicionales propuestas

- Antimalware en el agente del hospital antes del push (Sprint 8 backlog).
- Pruebas de penetración anuales por proveedor externo (pendiente contratar).
- Plan de recuperación documentado (`docs/dr-plan.md` — pendiente).

## 5. Consulta a interesados

- Cláusula informativa del hospital al firmar contrato.
- Banner en el portal del profesional al primer login.
- Sin tratamiento de datos de menores no acompañados ni perfilado automatizado.

## 6. Resultado

- DPIA aprobada por DPO el **YYYY-MM-DD**.
- Riesgos residuales aceptables (sin ninguno > 6 tras mitigación).
- Revisión obligatoria al activarse cualquier funcionalidad de IA o
  cambiar de proveedor de almacenamiento.

## Apéndice: cumplimiento técnico verificable

| Medida | Implementación en código |
|---|---|
| Cifrado en reposo | `apps/back/src/common/crypto/column-encryption.service.ts` |
| Pseudonimización | `apps/back/src/common/crypto/pseudonym.service.ts` |
| Audit hash-chain | `apps/back/src/common/audit/audit-log.service.ts` |
| MFA TOTP | `apps/back/src/auth/v1/mfa.service.ts` |
| RBAC + Tenant | `apps/back/src/auth/abilities/ability.factory.ts`, `apps/back/src/common/tenant/tenant-scope.ts` |
| RLS | `infra/migrations/001-enable-rls.sql`, `apps/back/src/common/tenant/rls-context.interceptor.ts` |
| Derechos del interesado | `apps/back/src/me/v1/me.controller.ts` |
| Notificaciones de brecha | `docs/breach-procedure.md` |
