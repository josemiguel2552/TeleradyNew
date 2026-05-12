# Esquema Nacional de Seguridad (ENS) — mapeo

Categoría objetivo: **media** según RD 311/2022. Justificación: tratamiento
de datos de salud (art. 41.1 RGPD = "categoría especial"), sin tratamiento
masivo de datos del sector público.

> Esta tabla mapea cada medida exigible a su implementación en código /
> proceso. La auditoría inicial ENS se contrata con un proveedor externo
> antes del primer despliegue productivo.

## Marco operacional (op.)

| Medida ENS | Estado | Implementación |
|---|---|---|
| op.acc.1 Identificación | OK | `telerady.app_user.email` único, MFA TOTP. |
| op.acc.2 Requisitos de acceso | OK | RBAC + CASL, mínimos por rol. |
| op.acc.4 Proceso de gestión de derechos de acceso | Parcial | Asignación de roles vía CLI / admin endpoint. Workflow formal de aprobación pendiente. |
| op.acc.5 Autenticación | OK | argon2id + MFA TOTP + lockout. |
| op.acc.6 Acceso local | OK | Sólo via Telerady; sin SSH directo a BD. |
| op.exp.1 Inventario de activos | Pendiente | Vincular a registro de assets en Vault + IaaS. |
| op.exp.2 Configuración de seguridad | OK | Helmet + Zod env + CORS allowlist + Throttler. |
| op.exp.3 Gestión de la configuración | Parcial | Cambios versionados en git; falta CMDB formal. |
| op.exp.4 Mantenimiento | Parcial | Patching mensual de containers (a documentar). |
| op.exp.8 Registro de la actividad | OK | `audit_log` append-only + hash chain + verify endpoint. |
| op.exp.9 Registro de los usuarios | OK | `app_user` + `user_role_assignment` + audit. |
| op.cont.1 Análisis de impacto | OK | DPIA en `docs/DPIA-template.md`. |
| op.cont.2 Plan de continuidad | Pendiente | DR plan documentar en `docs/dr-plan.md`. |
| op.cont.3 Pruebas periódicas | Pendiente | DR drill trimestral planificado. |

## Marco de protección (mp.)

| Medida ENS | Estado | Implementación |
|---|---|---|
| mp.if.1 Áreas separadas con control de acceso | N/A | Centro de datos del IaaS soberano. |
| mp.if.2 Identificación de las personas | N/A | Idem (responsabilidad del IaaS). |
| mp.if.4 Energía eléctrica | N/A | Idem. |
| mp.com.1 Perímetro seguro | OK | Helmet/CORS/Throttler; CSP en frontend. |
| mp.com.2 Protección de la confidencialidad | OK | TLS 1.3; AES-256-GCM por columna. |
| mp.com.3 Protección de la autenticidad e integridad | OK | JWT firmado + hash chain + TSA en informes. |
| mp.com.4 Segregación de redes | Pendiente | VPC + subredes privadas en deploy. |
| mp.si.1 Protección de la información | OK | Cifrado en reposo y tránsito. |
| mp.si.2 Datos de carácter personal | OK | Ver `docs/RGPD-CHECKLIST.md` + RLS. |
| mp.si.5 Limpieza de documentos | Parcial | Borrado lógico + purga programada (Sprint 8). |
| mp.sw.1 Adquisición / desarrollo | OK | Stack open-source con licencia clara; SCA via gitleaks + npm audit. |
| mp.sw.2 Aceptación y puesta en producción | OK | CI con tests + secret scan. |
| mp.s.1 Protección de los servicios | OK | TLS 1.3 + HSTS + CSP. |
| mp.s.2 Protección de servicios web | OK | OWASP Top 10 verificado en threat model. |
| mp.s.8 Protección frente a DoS | Parcial | Throttler por IP; WAF a contratar en deploy. |
| mp.info.1 Cifrado | OK | AES-256-GCM, argon2id, TLS 1.3. |
| mp.info.4 Firma electrónica | Parcial | TSA mock; eIDAS cualificada en Sprint 8. |
| mp.info.6 Limpieza de soportes | Pendiente | Procedimiento de destrucción de discos al rotar HW (responsabilidad IaaS). |

## Marco organizativo (org.)

| Medida ENS | Estado | Implementación |
|---|---|---|
| org.1 Política de seguridad | Pendiente | Redactar `docs/security-policy.md`. |
| org.2 Normativa de seguridad | Pendiente | Idem. |
| org.3 Procedimientos de seguridad | Parcial | `docs/breach-procedure.md`, `docs/RLS-ACTIVATION-RUNBOOK.md`. |
| org.4 Proceso de autorización | Pendiente | Workflow formal de altas + bajas. |

## Próximos pasos

1. Contratar auditor ENS acreditado.
2. Redactar las políticas pendientes (`security-policy.md`, `dr-plan.md`).
3. Programar DR drill y publicar resultados.
4. Sustituir el mock TSA por proveedor eIDAS cualificado.
5. Configurar SIEM / pino → Loki con alertas en métricas críticas.
