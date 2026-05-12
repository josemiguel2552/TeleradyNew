# Infra — Telerady

Stack local de desarrollo. Para producción se replicará el mismo esquema sobre
proveedor soberano español (Postgres gestionado, MinIO multi-nodo o S3 nativo,
Orthanc dedicado, Vault HA).

## Arranque

```bash
docker compose -f infra/docker-compose.dev.yml up -d
docker compose -f infra/docker-compose.dev.yml ps
```

## Servicios

| Servicio | Puerto host | Notas |
|---|---|---|
| Postgres 16 | 5432 | user/pass `telerady` / `telerady` |
| Redis 7 | 6379 | password `telerady` |
| MinIO | 9000 (API), 9001 (consola) | `teleradyminio` / `teleradyminio` |
| Orthanc | 8042 (web/REST), 4242 (DICOM) | `telerady` / `telerady` |
| Vault dev | 8200 | root token `telerady-dev-root` |

> Las credenciales **sólo** son válidas para dev local. En producción se
> generan via Vault y se rotan periódicamente.

## Apagado

```bash
docker compose -f infra/docker-compose.dev.yml down       # mantiene volúmenes
docker compose -f infra/docker-compose.dev.yml down -v    # borra datos
```

## Inicialización

- Postgres aplica `apps/back/db-seed.sql` la primera vez que arranca.
- MinIO crea los buckets `telerady-reports` y `telerady-documents` mediante el
  contenedor de un solo uso `minio-init`.
- Vault arranca en modo dev (in-memory, **no usar en prod**).

## Producción

`infra/docker-compose.prod.yml` se añadirá en Sprint 8 cuando el stack esté
estable. Mientras tanto, el desplegador documenta cómo replicar este compose
en el proveedor elegido.
