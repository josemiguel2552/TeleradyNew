# Checklist RGPD / LOPDGDD — Telerady

Este documento es operativo: cada ítem tiene responsable y referencia a código
o procedimiento. Se revisa al cierre de cada sprint.

## 1. Base jurídica y categoría de datos

- [ ] Identificada la base jurídica para cada tratamiento (consentimiento,
      ejecución de contrato, interés legítimo, art. 9.2.h para datos de salud).
- [ ] Categoría especial art. 9: datos clínicos requieren medidas reforzadas
      (cifrado por columna + control de acceso estricto).
- [ ] DPO designado y publicado en el sitio.

## 2. Principios (art. 5)

| Principio | Implementación |
|---|---|
| Licitud, lealtad, transparencia | Información clara en alta de hospital/profesional |
| Limitación de finalidad | Por tabla: documentado en `docs/DATA-MAP.md` (pendiente Sprint 1) |
| Minimización | DTOs con whitelist, no se piden datos no necesarios |
| Exactitud | Endpoint de actualización + auditoría de cambios |
| Limitación del plazo | `retention_policy` configurable por hospital |
| Integridad y confidencialidad | AES-256-GCM, argon2id, RLS, audit chain |
| Responsabilidad proactiva | Este documento + ROPA + DPIA |

## 3. Derechos de los interesados (art. 15-22)

- [ ] **Acceso**: endpoint `GET /v1/me/data-export` que devuelve dump propio.
- [ ] **Rectificación**: ya existe `PUT /v1/personal-data`.
- [ ] **Supresión**: endpoint que aplica borrado lógico + purga programada.
- [ ] **Limitación**: flag `processing_restricted` por usuario.
- [ ] **Portabilidad**: export en JSON estructurado + DICOM en zip.
- [ ] **Oposición**: oposición a tratamientos no esenciales (marketing).
- [ ] **Decisiones automatizadas**: si volvemos a usar IA, banner explicativo y
      derecho a revisión humana (art. 22).

## 4. Seguridad técnica (art. 32)

- [x] Cifrado en tránsito: TLS 1.3 (config nginx/traefik en prod).
- [ ] Cifrado en reposo BD: AES-256-GCM por columna (Sprint 1).
- [ ] Cifrado en reposo storage: SSE en MinIO/S3 (Sprint 2).
- [x] Pseudonimización: HMAC-SHA256 con pepper en eventos (Sprint 0).
- [x] Hashing de passwords: argon2id (Sprint 0 util, Sprint 1 endpoint).
- [x] Resiliencia: backups + DR drill (procedimiento Sprint 8).
- [x] Pruebas regulares de eficacia: pen-test interno (Sprint 8).

## 5. Registro de actividades (art. 30)

`docs/ROPA.md` (pendiente Sprint 8) contendrá:
- Nombre del responsable y DPO.
- Finalidades del tratamiento.
- Categorías de interesados y datos.
- Destinatarios (encargados, terceros países).
- Plazos de supresión.
- Medidas técnicas y organizativas.

## 6. Encargados de tratamiento (art. 28)

| Encargado | Datos | Contrato art. 28 |
|---|---|---|
| Proveedor de hosting (Stackscale/Arsys) | Todos | Pendiente firma |
| MinIO / S3 soberano | Imágenes, PDFs | Pendiente |
| TSA cualificada eIDAS | Hash + ts | Pendiente |
| Email transaccional | Email, nombre | Pendiente |
| Google (Drive — legacy) | Documentos prof. | **A retirar Sprint 2** |

## 7. Transferencias internacionales (art. 44-49)

Objetivo: todo en UE. Si hay transferencia (p.ej. soporte fuera de UE) requiere
SCC + medidas suplementarias y se documenta en ROPA.

## 8. Brechas (art. 33-34)

- [ ] Procedimiento de notificación a AEPD en 72h.
- [ ] Procedimiento de comunicación al interesado si alto riesgo.
- [ ] Registro interno de brechas con plantilla.

## 9. DPIA (art. 35)

Procede DPIA por: datos de salud + perfilado/IA (si se reincorpora) + uso
sistemático de datos. Plantilla en `docs/DPIA-template.md` (Sprint 8).

## 10. Privacidad desde el diseño y por defecto (art. 25)

- Default: opciones de mínima divulgación.
- No tracking analítico de terceros.
- Cookies estrictamente necesarias por defecto; banner conforme guía AEPD.

## Estado actual (Sprint 0)

Implementado:
- Pseudonimización de `pat_id` en event_log
- Sanitización de inputs externos en queries Drive
- Plantilla de retención (DB schema en Sprint 1)
- Hash chain de auditoría
- Cifrado en tránsito (config base)
- Argon2id utility lista
- Eliminación de IA radiogenia (reduce alcance DPIA)

Pendiente:
- Cifrado por columna activo (Sprint 1)
- Endpoints de derechos del interesado (Sprint 6)
- ROPA, DPIA, contratos art. 28 firmados (Sprint 8)
