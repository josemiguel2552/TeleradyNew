# Disaster Recovery — Telerady

Cómo recuperar la plataforma tras un incidente que tumba la BD o el
almacenamiento. Objetivos:

| Métrica | Objetivo |
|---|---|
| **RPO** (datos que estamos dispuestos a perder) | 24 h |
| **RTO** (tiempo hasta servicio disponible) | 4 h |
| **RTO crítico** (sólo lectura + acceso a auditoría) | 1 h |

## Activos a proteger

| Activo | Backup | Frecuencia | Encripción | Retención |
|---|---|---|---|---|
| Postgres (esquemas `public` + `telerady`) | `scripts/backup.sh` → `pg_dump` custom format → GPG → S3 backup | Diaria 03:00 UTC | AES-256 (GPG asymmetric) + SHA-256 hash | 90 días en bucket, 7 años en glacier soberano |
| MinIO/S3 buckets (`telerady-reports`, `telerady-documents`) | Replicación cross-bucket nativa | Tiempo real | SSE-S3 | 90 días versión vieja |
| Audit log | Incluido en el dump Postgres | Idem | Idem | 10 años (legal hold) |
| Vault unseal keys | Off-site físicas (3-de-5 Shamir) | Manual | — | Indefinido |
| Secretos en Vault | `vault operator raft snapshot` | Diaria | TLS + token único | 30 días |

## Cron

Producción ejecuta diariamente:

```bash
0 3 * * *  /opt/telerady/scripts/backup.sh        >> /var/log/telerady/backup.log 2>&1
0 4 * * *  /opt/telerady/scripts/audit-verify.sh  >> /var/log/telerady/audit.log 2>&1
```

`audit-verify.sh` es un curl al endpoint `/v1/admin/audit/verify` con un
service token; si la respuesta no es `ok: true`, dispara una alerta de
PagerDuty (severity 1).

## Cut-over

### Caso A — la BD se corrompió o se borró

1. **Comunicación**: el equipo de ops envía mantenimiento via status
   page.
2. **Provisionar la BD nueva** (mismo plan, distinto host).
3. **Restaurar el último dump válido**:
   ```bash
   BACKUP_BUCKET=telerady-backup S3_ENDPOINT=… \
   ./scripts/restore.sh 2026-01-15 postgresql://migrator:***@new-host/telerady
   ```
4. **Aplicar la migración RLS** (`infra/migrations/001-enable-rls.sql`)
   con el rol `telerady_migrator`.
5. **Re-cifrar credenciales**:
   - Generar nueva clave `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`
     (esto invalida todas las sesiones — el cliente verá un re-login).
   - `ENCRYPTION_MASTER_KEY` se mantiene: si la pierdes pierdes el cifrado
     por columna y no hay vuelta atrás. Vault custodia la copia.
6. **Apuntar la API al nuevo `DATABASE_URL`** y reiniciar.
7. **Smoke test** (`scripts/smoke.sh`) contra el deploy.
8. **Levantar la página al público**; monitorizar latencias 1 h.

### Caso B — el almacenamiento de objetos se corrompió

S3 soberano tiene versionado activado por contrato. Para restaurar:

```bash
aws s3api list-object-versions --bucket telerady-reports --prefix reports/ \
  > versions.json
# escoger la versión válida y aws s3api restore-object
```

Si el bucket entero es papel, recuperar del backup cross-region (mismo
proveedor) — ver runbook del proveedor.

### Caso C — pérdida de Vault (caso crítico)

1. Recolectar 3 de las 5 unseal keys físicas.
2. `vault operator init -recovery-shares=5 -recovery-threshold=3` no es
   válido aquí — usamos `vault operator unseal` con cada key.
3. Si las unseal keys también se perdieron, los datos cifrados se han
   perdido permanentemente. Es por esto que **`ENCRYPTION_MASTER_KEY` y
   las unseal keys nunca residen en el mismo lugar físico**.

## Drill trimestral

Una vez por trimestre, el operador on-call ejecuta:

1. Restaurar el backup en un cluster aislado.
2. Levantar la API contra esa BD.
3. Ejecutar `scripts/smoke.sh` contra el cluster aislado.
4. Documentar:
   - Tiempo desde "incidente declarado" hasta "API verde".
   - Cualquier desviación frente a este runbook.
   - Acciones de mejora.

El reporte se firma con el DPO y se anexa al ROPA.

## Pruebas automatizadas en CI

GitHub Actions ejecuta un test que:
- Genera un mini dataset (`seed:demo`).
- Llama a `backup.sh` con un GPG keypair efímero contra MinIO local.
- Llama a `restore.sh` contra una BD limpia.
- Verifica que los datos coinciden fila a fila.

Workflow en `.github/workflows/backup-restore.yml` (Sprint 43):
ejecuta seed → pg_dump → GPG encrypt → pg_restore → row-count
parity en cada PR que toque los scripts de DR, la seed o las
migraciones, además de un cron semanal (domingo 04:00 UTC).
Cualquier silencio de >7 días en producción se detecta antes de
necesitar el plan en serio.

## Contactos

- **Operador on-call**: rotación PagerDuty `telerady-ops`.
- **DPO**: `dpo@telerady.es`.
- **Proveedor IaaS**: número 24×7 en la wiki interna (no en este repo).
- **AEPD** (en caso de brecha): trámite electrónico, sede.aepd.gob.es.
