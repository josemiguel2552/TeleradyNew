# Procedimiento de gestión de brechas — Telerady

Cumplimiento art. 33-34 RGPD. Plazo de notificación a la AEPD: **72 horas**
desde la detección.

## Roles

- **Coordinador de seguridad**: DPO + CTO (codecisión).
- **Operador de guardia**: persona on-call (Slack + PagerDuty).
- **Portavoz**: CEO o delegado para comunicación a clientes.

## Fases

### 1. Detección

Fuentes que disparan el procedimiento:

- Alerta de SIEM / pino structured logs.
- Aviso de un usuario o cliente.
- Reporte responsable (vía `security@telerady.es` — ver `SECURITY.md`).
- Hallazgo durante pen-test o auditoría.

> Incluso si la brecha es sospecha sin confirmar, abrir ticket clasificado
> como `SECURITY-INCIDENT`. Mejor pasarse a corto que perder los 72h.

### 2. Triaje (≤2 h)

El coordinador de seguridad evalúa:

- ¿Hay datos personales involucrados? Si no → no es brecha RGPD, gestionar
  como incidente operativo.
- ¿Hay riesgo para los derechos y libertades de los interesados? Si sí →
  notificar AEPD (siguiente paso).
- ¿Es alto riesgo? Si sí → también comunicación al interesado (art. 34).

Plantilla de triaje:

```
- Fecha y hora de detección:
- Fecha y hora estimada de inicio:
- Sistemas afectados:
- Datos potencialmente afectados (categorías + nº aproximado):
- Mecanismo de la brecha (confidencialidad / integridad / disponibilidad):
- Estado actual (en curso / contenida / cerrada):
- Acciones inmediatas tomadas:
```

### 3. Contención (≤4 h)

- Revocar credenciales comprometidas (rotar `JWT_*_SECRET`, `ENCRYPTION_MASTER_KEY`,
  passwords de servicio en Vault).
- Bloquear cuentas afectadas (`telerady_app` puede ser reemplazado por
  uno nuevo y deshabilitar el viejo).
- Aislar instancias comprometidas; preservar evidencia (snapshot RDS,
  copia de logs antes de rotar).
- Comunicar internamente; **no** comunicar externamente todavía.

### 4. Análisis (≤24 h)

- Verificar la cadena de auditoría con `POST /v1/admin/audit/verify`.
- Reconstruir la cronología desde `audit_log` + `event_log` + logs pino.
- Identificar tipo y volumen de datos afectados.
- Determinar si los datos estaban cifrados en reposo y/o pseudonimizados.

### 5. Notificación a AEPD (≤72 h)

Vía formulario AEPD (sede.aepd.gob.es). Información obligatoria:

- Naturaleza de la violación.
- Categorías y nº aproximado de interesados.
- Categorías y nº aproximado de registros de datos.
- Datos de contacto del DPO.
- Probables consecuencias.
- Medidas adoptadas o propuestas.

Si la información completa no está disponible, notificar parcialmente y
completar más tarde (art. 33.4).

### 6. Comunicación al interesado (si alto riesgo)

Vía email + carta postal si dato sensible. Lenguaje claro, sin tecnicismos:

```
[Resumen en una frase de qué ha pasado.]
- Qué datos tuyos podrían haberse visto afectados.
- Qué pasos hemos dado.
- Qué te recomendamos hacer (cambiar password, vigilar movimientos).
- A quién contactar (DPO, AEPD).
```

### 7. Cierre y registro interno

Documentar en `incidents/YYYY-MM-DD-<slug>.md` (folder privado, no en
este repo): cronología, causa raíz, datos afectados, comunicaciones
hechas, mejoras incorporadas al backlog.

## Excepciones

- **No es necesario notificar a la AEPD** si no es probable que la brecha
  suponga riesgo para los derechos y libertades. Justificar por escrito.
- **No es necesario comunicar al interesado** si los datos estaban
  cifrados y la clave no se ha visto afectada, o si la comunicación
  supondría esfuerzo desproporcionado (comunicar entonces de forma
  pública).

## Simulacro

Una vez al año (DR drill + tabletop). Verificar:

- Tiempo desde detección hasta notificación.
- Calidad de la información recogida.
- Funcionamiento del canal `security@telerady.es`.
- Acceso de respaldo al panel AEPD.
