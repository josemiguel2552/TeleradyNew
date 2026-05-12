# Postgres Row-Level Security — plan

RLS es la segunda capa de defensa de aislamiento entre hospitales. La primera
es `TenantScope` en `apps/back/src/common/tenant/tenant-scope.ts`, que filtra
en todos los repositorios. RLS es el cinturón de seguridad si alguien algún
día se olvida de aplicar el scope.

Se difiere a Sprint 2 (cuando los repositorios clínicos se reescriban con
`TenantScope` ya como contrato) por dos razones:

1. RLS requiere que cada petición HTTP corra contra una **conexión propia**
   o establezca `SET LOCAL app.current_user_id` y `app.current_hospital_ids`
   al inicio de cada transacción. Antes de cablearlo necesitamos pool por
   request, y de momento Drizzle comparte la conexión.

2. Activar RLS sin BYPASSRLS para el usuario que ejecuta migraciones rompe
   las migraciones. El despliegue tiene que separar roles: `telerady_app`
   sin BYPASSRLS y `telerady_migrator` con BYPASSRLS.

## Policies previstas

```sql
-- Habilitar RLS en cada tabla con hospital_id.
ALTER TABLE telerady.report_study ENABLE ROW LEVEL SECURITY;
ALTER TABLE telerady.report_study FORCE ROW LEVEL SECURITY;

-- Política de SELECT/UPDATE/DELETE: el usuario debe pertenecer al hospital.
CREATE POLICY rs_tenant_read ON telerady.report_study
    FOR SELECT
    USING (
        hospital_id = ANY (current_setting('app.current_hospital_ids')::uuid[])
        OR current_setting('app.is_privileged', true)::bool
    );

CREATE POLICY rs_tenant_write ON telerady.report_study
    FOR ALL
    USING (
        hospital_id = ANY (current_setting('app.current_hospital_ids')::uuid[])
        OR current_setting('app.is_privileged', true)::bool
    )
    WITH CHECK (
        hospital_id = ANY (current_setting('app.current_hospital_ids')::uuid[])
        OR current_setting('app.is_privileged', true)::bool
    );

-- Igual para hospital_membership, refresh_token, audit_log (lectura), event_log.
```

## Middleware previsto (Sprint 2)

```ts
// Pseudo-código. NestJS middleware o interceptor.
async function setSessionRls(req: Request) {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user) return;
  await db.execute(sql`
    SELECT set_config(
        'app.current_hospital_ids',
        ${`{${user.hospitalIds.join(',')}}`},
        true
    ),
    set_config(
        'app.is_privileged',
        ${user.roles.some(r => ['admin','coordinator'].includes(r)) ? 'true' : 'false'},
        true
    )
  `);
}
```

`set_config(..., true)` aplica el valor sólo durante la transacción actual,
así no contamina conexiones reutilizadas.

## Pruebas

`apps/back/test/integration/tenant-isolation.spec.ts` (a crear en Sprint 2):
- Crear dos hospitales A y B.
- Crear un radiólogo en A.
- Insertar un `report_study` para cada hospital.
- Autenticar como el radiólogo de A y comprobar que no ve el estudio de B,
  primero a través del repo (TenantScope) y luego mediante una conexión
  directa con las claims falsas para verificar la policy.

## Riesgo controlado mientras tanto

`TenantScope` cubre el flujo HTTP autenticado normal. Lo que no cubre:
- Acceso directo a la BD por un atacante con credenciales del rol `telerady_app`.
- Olvido futuro de aplicar `TenantScope` en un nuevo repositorio.

Para el primero, los secretos del rol están en Vault y rotan. Para el segundo,
la convención es revisar cada PR que toque un repo bajo `src/**/repositories/`
y RLS lo backstoppea desde Sprint 2.
