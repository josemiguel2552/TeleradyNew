# Política de seguridad

## Reporte de vulnerabilidades

Telerady gestiona datos clínicos y datos personales de profesionales sanitarios.
Cualquier vulnerabilidad debe reportarse **de forma privada** antes de divulgarla.

- Email seguro: `security@telerady.es` (PGP en el sitio público cuando esté disponible).
- Respuesta inicial: 48 horas laborables.
- Coordinación de divulgación responsable según el modelo CVD.

No abrir issues públicos para vulnerabilidades. No probar exploits en sistemas
productivos sin acuerdo previo.

## Versiones con soporte

Actualmente en desarrollo activo. Soporte de seguridad sólo para `main`.

## Buenas prácticas internas

- Todos los secretos via variables de entorno; nunca en código ni en git.
- Pre-commit hook con [gitleaks](https://github.com/gitleaks/gitleaks).
- Hashing de passwords con argon2id (memoryCost 64 MiB, timeCost 3, parallelism 4).
- Cifrado de datos sensibles en reposo con AES-256-GCM y envelope encryption.
- TLS 1.3 obligatorio en producción.
- MFA obligatorio para roles `coordinator` y `admin`.
- Auditoría inmutable con hash chain de eventos críticos.

## Cumplimiento

- RGPD (Reglamento UE 2016/679) y LOPDGDD.
- Esquema Nacional de Seguridad (ENS) categoría media como objetivo.
- ISO 27001 como meta a medio plazo.
