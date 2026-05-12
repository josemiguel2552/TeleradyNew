# Registro de actividades de tratamiento (ROPA) — Telerady

Versión: 1.0 · Última revisión: pendiente · Responsable: pendiente designar

> Plantilla viva. Actualizar cuando se incorpore una actividad nueva, un
> nuevo encargado o se modifique la base jurídica de un tratamiento.

## Identidad

- **Responsable del tratamiento**: Telerady S.L. (en constitución).
- **DPO**: pendiente designar y notificar a la AEPD.
- **Dirección postal y email del DPO**: pendiente.

## A) Actividades de tratamiento del responsable

### A.1 Prestación de servicios de teleradiología (núcleo)

| Campo | Valor |
|---|---|
| Finalidad | Permitir que radiólogos remotos informen estudios DICOM de hospitales clientes. |
| Categorías de interesados | Pacientes, profesionales sanitarios (radiólogos), personal de hospital, personal interno. |
| Categorías de datos | Datos identificativos, datos clínicos (categoría especial art. 9), datos académicos/profesionales, datos económicos (IBAN). |
| Origen de los datos | Hospitales clientes (estudios y datos de paciente), profesionales (alta directa), agente local (carga DICOM). |
| Base jurídica | art. 9.2.h RGPD (prestación de asistencia sanitaria); ejecución de contrato con hospital cliente; obligaciones legales. |
| Destinatarios | Hospital cliente, encargados de tratamiento listados en sección B. No se ceden a terceros sin base jurídica. |
| Transferencias internacionales | No previstas. Toda infra en UE/España. |
| Plazo de conservación | Por defecto 10 años desde el alta del informe (configurable por hospital en `telerady.hospital.retention_days`). |
| Medidas técnicas | Cifrado AES-256-GCM por columna en BD; SSE-S3 en almacenamiento; argon2id en passwords; MFA TOTP obligatorio para admin/coordinator; RBAC + RLS Postgres; auditoría hash-chained; TLS 1.3. |
| Medidas organizativas | Acuerdos de confidencialidad; política de mesas limpias; formación anual; pen-test anual; DPO con canal directo. |

### A.2 Captación de profesionales

| Campo | Valor |
|---|---|
| Finalidad | Onboarding de radiólogos y gestión documental (titulación, colegiación, DNI, seguro RC, IBAN). |
| Base jurídica | Ejecución de contrato + consentimiento para almacenamiento de documentos. |
| Plazo | 5 años desde la baja como colaborador. |
| Medidas | Documentos en MinIO/S3 con SSE; signed URLs ≤5 min; cifrado de `bank_account`. |

### A.3 Gestión administrativa interna

| Campo | Valor |
|---|---|
| Finalidad | Facturación, contabilidad, soporte. |
| Base jurídica | Obligaciones legales (Ley General Tributaria, Código de Comercio). |
| Plazo | 6 años desde el ejercicio. |

## B) Encargados de tratamiento (art. 28 RGPD)

| Encargado | Datos tratados | Servicio | Contrato art. 28 | Localización |
|---|---|---|---|---|
| Stackscale / Arsys / Jotelulu (a elegir) | Todos (alojamiento) | IaaS | Pendiente firma | España |
| MinIO operado internamente o proveedor S3 soberano | Imágenes, PDFs, documentos profesionales | Object storage | Pendiente firma | España |
| Postmark EU / SES eu-south-2 (a elegir) | Email transaccional | Notificaciones | Pendiente firma | UE |
| Autoridad TSA cualificada eIDAS (ANF AC / SafeStamper / Camerfirma) | Hash + timestamp | Timestamping | Pendiente firma | UE |
| GitHub | Código (no datos personales) | Repositorio | DPA estándar | EEUU (SCC + medidas suplementarias) |

## C) Análisis de riesgos

Disparadores de DPIA cumplidos (art. 35.3 RGPD):

- Tratamiento sistemático y a gran escala de datos de salud → **DPIA obligatoria**.
- Tecnología innovadora (radiología remota con almacenamiento centralizado).

Plantilla en `docs/DPIA-template.md`.

## D) Brechas

Procedimiento en `docs/breach-procedure.md`. Plazo de notificación AEPD: 72 h.

## E) Revisión

- Revisión semestral por DPO + CTO.
- Cualquier nuevo encargado de tratamiento debe firmarse antes de empezar a procesar datos.
- Esta tabla es la fuente de verdad para la cláusula informativa del frontend.
