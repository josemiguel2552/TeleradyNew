# Observability stack — Prometheus + Loki + Promtail + Grafana

Add-on docker-compose ready to attach to the existing dev stack. Use it
if you want to look at the API logs in Grafana while you click through
the demo flows.

## Arranque

```bash
# 1. el stack base
docker compose -f infra/docker-compose.dev.yml up -d

# 2. el stack de observabilidad (se une a la red telerady-dev)
docker compose -f infra/observability/docker-compose.yml up -d

# 3. abre Grafana
open http://localhost:3001     # admin / admin
```

## Qué hay arriba

| Servicio | Puerto | Para |
|---|---|---|
| Prometheus | 9090 | Métricas (HTTP, latencias, jobs) |
| Loki | 3100 | Logs agregados |
| Promtail | — | Tail de logs de cualquier contenedor de la red `telerady-dev` |
| Grafana | 3001 | UI |

Las datasources (Loki + Prometheus) están provisionadas; el dashboard
*Telerady — API overview* incluye logs de la API, Postgres y Orthanc, y
un panel con `up` para ver qué targets responden.

## Cómo se conecta

Promtail descubre contenedores con `docker_sd_configs` y los etiqueta
con `container`, `service` y `project`. La API arranca con `pino` en
formato JSON, que se parsea con `| json` en LogQL.

Prometheus apunta a `host.docker.internal:3000/metrics` — el endpoint
todavía no existe (Sprint 17 añadirá `prom-client`); de momento ves un
target en down, pero los logs están operativos.

## Producción

En producción todo esto se reemplaza por un servicio gestionado (Grafana
Cloud, AWS Managed Grafana, observabilidad del proveedor soberano). El
docker-compose de aquí es sólo para desarrollo local.
