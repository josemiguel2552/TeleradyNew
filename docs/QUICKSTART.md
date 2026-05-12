# Cómo probar Telerady en tu portátil

Esta guía está pensada para que pruebes la plataforma sin tener que leer
código. Si te trabas en algún paso, copia el error y mándamelo: cada paso
es independiente, no hace falta acabar todo de una sentada.

> **Resumen**: instalas Docker y Node, abres una terminal, ejecutas dos
> comandos y entras al portal del radiólogo en tu navegador.

## 1. Requisitos previos

Instala estos dos programas si no los tienes ya:

| Programa | Para qué sirve | Dónde |
|---|---|---|
| **Docker Desktop** | Levanta la base de datos, MinIO y Orthanc en tu portátil sin instalarlos a mano | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js 22 LTS** | Compila y arranca el back y el front | [nodejs.org/en/download](https://nodejs.org/en/download) (instala "LTS") |

Comprueba que están bien:

```bash
docker --version
node --version    # debe decir v22.x o v20.x
npm --version
```

> **Windows**: usa la app **Docker Desktop** y abre **PowerShell** o
> **Windows Terminal**. Si nunca abriste una terminal, busca "PowerShell"
> en el menú inicio.
>
> **macOS**: usa la app **Terminal** o **iTerm**.

## 2. Bajarte el código

Si te he pasado el repo, descárgalo a tu carpeta de trabajo, por ejemplo
`~/projects/TeleradyNew`. Desde ahí:

```bash
cd ~/projects/TeleradyNew
```

(En Windows: `cd %USERPROFILE%\projects\TeleradyNew`.)

## 3. Configurar las variables de entorno

```bash
cp .env.example .env
cp apps/back/.env.example apps/back/.env 2>/dev/null || true
```

Abre `.env` en cualquier editor de texto (Notepad, TextEdit, VSCode…) y
**genera dos claves al azar** — son las claves de cifrado y la sal de
pseudonimización. En macOS/Linux:

```bash
openssl rand -hex 32        # copia esto a ENCRYPTION_MASTER_KEY
openssl rand -hex 32        # copia esto a PSEUDONYM_PEPPER
openssl rand -hex 32        # copia esto a JWT_ACCESS_SECRET
openssl rand -hex 32        # copia esto a JWT_REFRESH_SECRET
openssl rand -hex 32        # copia esto a AUDIT_HASH_CHAIN_SEED
```

En Windows PowerShell:

```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

Reemplaza los `change-me-...` del `.env` por las cadenas que te salgan.
**Importante**: el `.env` nunca se sube al repo (está en `.gitignore`).
Si pierdes las claves se pierde el cifrado, así que guárdalas también en
un gestor de contraseñas mientras pruebes.

> Si no quieres pelearte con esto, **copia el `.env.example` tal cual y
> arranca**: las claves de ejemplo no son seguras pero te dejan probar.

Luego copia el mismo `.env` a la carpeta del back para que `seed:demo` lo
encuentre:

```bash
cp .env apps/back/.env
```

## 4. Levantar los servicios (Postgres, MinIO, Orthanc)

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

La primera vez se baja como 1 GB de imágenes (Postgres, Orthanc, MinIO).
Cuando termine, verifica que está todo arriba:

```bash
docker compose -f infra/docker-compose.dev.yml ps
```

Deberías ver `telerady-postgres`, `telerady-redis`, `telerady-minio`,
`telerady-orthanc` y `telerady-vault` en estado `running` o `healthy`.

## 5. Instalar dependencias

```bash
cd apps/back
npm install
cd ../front
npm install
cd ../..
```

(La primera vez tarda 2-3 min en total.)

## 6. Crear datos de demo

Vuelve a la carpeta del back y ejecuta el seed:

```bash
cd apps/back
npm run seed:demo
```

Verás algo como:

```
Seeding demo data…
  hospital created -> 8d4b…
  professional created -> 11a9…
  users ensured: admin / radiologist / hospital_admin
  3 sample studies ensured
  1 MWL entry scheduled for tomorrow

Demo seed complete. Credentials:
  admin@telerady.test     /  AdminDemo!2026
  pepa@telerady.test      /  RadDemo!2026   (radiologist)
  hospital@telerady.test  /  HospitalDemo!2026
```

Guarda esos correos y contraseñas, los vas a usar en el navegador.

## 7. Arrancar el back

En la misma terminal:

```bash
npm run start:dev
```

Deja esa terminal abierta. Cuando veas `Telerady API listening on port 3000`
es que está listo.

## 8. Arrancar el front

**Abre otra terminal**, ve a la carpeta del front y arranca:

```bash
cd ~/projects/TeleradyNew/apps/front
npm start
```

Espera a que diga `Application bundle generation complete` (suele tardar
30-60 s la primera vez). Entonces abre el navegador en:

```
http://localhost:4200/login
```

## 9. Probar los flujos

### Flujo A — Soy radiólogo, quiero informar

1. Entra en `http://localhost:4200/login`.
2. Email **pepa@telerady.test** / contraseña **RadDemo!2026**.
3. Aterrizas en `/radiologist/worklist`. Verás los 3 estudios demo que
   creó el seed.
4. Click "**Open**" en cualquiera → ves la cabecera del paciente
   descifrada y el visor OHIF embebido (estará vacío porque no hemos
   subido imagen DICOM real, pero la integración está; en el paso C lo
   completamos).
5. Click "**Edit report**" → editor con plantillas por modalidad. Escribe
   algo en *Hallazgos* y *Conclusión*. Cada vez que dejes de escribir
   800 ms se autoguarda — verás "Saved hh:mm" arriba.
6. Cambia "Modality" si quieres cambiar la plantilla de secciones.
7. Click "**Sign**" → diálogo. Como el hospital tiene política
   `name_collegiate`, sólo te pide confirmar nombre y colegiado (puedes
   dejarlos vacíos y usa los del perfil).
8. Acepta. Se firma, se genera el PDF y aparece el botón "**Open PDF**":
   click y se abre el PDF firmado en otra pestaña.
9. Click "**Send to hospital**" → estado pasa a `sent`. Ese envío deja
   huella en el audit log (la verás en el flujo B).

### Flujo B — Soy admin, quiero ver SLA y auditoría

1. **Cierra sesión** (el front no tiene aún botón de logout en el área
   nueva; simplemente borra cookies o abre ventana privada).
2. Entra en `/login` con **admin@telerady.test** / **AdminDemo!2026**.
3. Aterrizas en `/admin/sla` con las cinco tiles del dashboard.
4. Click en `/admin/assignments` (cambia la URL): ves la worklist de
   todos los hospitales con un botón "Assign" por fila. Abre el diálogo;
   el dropdown ya filtra entre profesionales escribiendo (busca "Pepa").
5. Click en `/admin/audit`: tabla con todos los eventos auditados
   (login, ingest, draft_updated, signed, sent…). Click "**Verify
   chain**" → debe devolver `Chain verified across N entries.` con tag
   verde. Si alguien tocó la BD a mano te diría qué fila se rompió.
6. Click en `/admin/me`: puedes descargar tu **export RGPD** (botón
   azul) y, si quieres probar la supresión, **eliminar tu cuenta**
   (botón rojo) — recuerda que es tombstone, no borrado físico, y
   pierdes acceso inmediatamente.

### Flujo C — Subir un DICOM real al PACS y verlo en OHIF

Esto necesita imágenes DICOM de ejemplo. Si tienes alguna, súbela vía
la consola web de Orthanc:

1. Abre `http://localhost:8042` en el navegador.
2. Login: **telerady / telerady**.
3. Pestaña "Upload" → arrastra un `.dcm` o un zip con un estudio.
4. Orthanc lo ingiere y aparece en su lista. Apunta su **StudyInstanceUID**
   (lo ves en la columna correspondiente).
5. Vuelve al back y haz una llamada para registrar el estudio en
   Telerady:

   Con `curl` (o usa el [Postman desktop](https://www.postman.com/downloads/)):

   ```bash
   # 1. obtén el access token
   ACCESS=$(curl -s -X POST http://localhost:3000/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"pepa@telerady.test","password":"RadDemo!2026"}' \
     | grep -o '"accessToken":"[^"]*"' | cut -d\" -f4)

   # 2. sincroniza el estudio
   curl -X POST http://localhost:3000/v1/pacs/studies/sync \
     -H "Authorization: Bearer $ACCESS" \
     -H "Content-Type: application/json" \
     -d '{"studyInstanceUid":"PEGA-AQUI-EL-UID"}'
   ```

6. Vuelve a `/radiologist/worklist` y refresca. El estudio nuevo
   aparece. Click "Open" → el iframe OHIF carga el estudio del Orthanc
   local.

> Si no tienes DICOM de prueba, te puedo dejar un zip pequeño con un
> estudio de muestra de dominio público (Imaios, OHIF demo). Dime y te
> lo paso.

### Flujo D — Pruebas rápidas con la consola Swagger

Para los flujos más complejos (asignación con regla, segunda lectura,
HL7v2, FHIR), te resulta más fácil usar la **consola de la API** que
está en `http://localhost:3000/api-docs/v1` (en desarrollo no pide
auth). Ahí ves cada endpoint con sus parámetros y un botón "Try it out".

## 10. Apagar todo

Cierra el back y el front con `Ctrl+C` en cada terminal. Para los
servicios Docker:

```bash
docker compose -f infra/docker-compose.dev.yml down
```

Si quieres **resetear los datos** (vuelve a estar todo vacío):

```bash
docker compose -f infra/docker-compose.dev.yml down -v
```

Y luego repite los pasos 4-7.

## Problemas habituales

**"docker: command not found"** → Docker Desktop no está arrancado.
Ábrelo y espera al icono verde de la barra.

**"port 5432 is already in use"** → tienes otro Postgres corriendo.
Pásalo a otro puerto en `infra/docker-compose.dev.yml` o párabolo.

**"npm install" se queda colgado en Windows** → activa "Long paths
support" en Windows: ejecuta como administrador
`git config --global core.longpaths true` y reinicia la terminal.

**"Invalid credentials" al hacer login** → confirma que ejecutaste
`npm run seed:demo` y que el back está arrancado.

**El editor de informe dice "Failed to load report"** → es normal en
estudios sin informe previo; pulsa cualquier campo y el autosave crea
el draft.

**Después de firmar no aparece "Open PDF"** → el back no pudo conectar
a MinIO. Verifica `docker compose ps` que `telerady-minio` está sano y
que el `.env` de la raíz tiene `S3_ENDPOINT=http://localhost:9000`.

---

¿Algún paso te ha fallado? Copia el error y mándamelo y te lo arreglo.
