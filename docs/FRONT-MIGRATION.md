# Plan de migración del front

El portal Angular 19 actual viene del legacy y arrastra varias deudas. Este
documento es la guía para limpiarlo sin romper el flujo en producción.

## Estado tras Sprint 0

- AI radiogenia eliminada (servicio, environments y llamadas).
- `SafeHtmlPipe` (bypass de la sanitización Angular) eliminado.
- `index.html` sin trackers de terceros.
- Tokens hardcodeados retirados de los `environment.*.ts`.
- Endpoint PACS movido a `apiPacs` que apuntará al proxy del back (Sprint 2).

## Migración del almacenamiento de tokens (Sprint 1)

Hoy: `TokenService` lee/escribe en `localStorage`. Vulnerable a XSS.

Objetivo Sprint 1:
1. El back emite el **refresh token** en una **cookie httpOnly** con
   `Secure=true` y `SameSite=Lax`.
2. El **access token** vive sólo en memoria del SPA (servicio que lo
   guarda en una variable privada del singleton).
3. `TokenInterceptor` adjunta el access token al header `Authorization` y,
   si recibe 401, llama a `/v1/auth/refresh` (envía la cookie httpOnly
   automáticamente) y reintenta una vez.
4. `logout` invoca `/v1/auth/logout` que invalida el refresh server-side.
5. CSRF: como el access viaja por header (no cookie), el flujo no es
   vulnerable a CSRF clásico. La cookie de refresh es httpOnly + SameSite.

## Refactor a standalone components + signals (Sprint 4)

Migración progresiva, página a página:
- Empezar por las pantallas de auth (login, register) por aislamiento.
- Luego portal de profesional, hospital y admin.
- Eliminar `NgModule` declarations a medida que las páginas migren.
- Sustituir RxJS `BehaviorSubject` por signals donde aplique.

## Eliminación del módulo `pages.module`

Es el último gran `NgModule` con declarations. Se elimina cuando todas las
páginas son standalone.

## Internacionalización

Mantener `es.yaml` y `en.yaml`. Limpiar claves muertas tras los refactors.

## Tests

Reescritura mínima sólo si una página migra. Mantener cobertura ≥ 60% en
servicios críticos (auth, token, studies).

## A eliminar definitivamente

- `assets/locales/*.yaml` referencias a radiogenia (limpieza progresiva).
- `chart.js`, `chartjs-plugin-datalabels` si las páginas de estadísticas se
  rehacen con primeng/charts.
- `jquery` si no se necesita en ningún módulo de PrimeNG/Bootstrap.

## Endurecimiento adicional

- CSP estricta vía header (no meta) desde el back en Sprint 1.
- Subresource Integrity en cualquier `<script src="...">` que sobreviva.
- Verificar que no quedan `console.log` con datos sensibles en producción.
