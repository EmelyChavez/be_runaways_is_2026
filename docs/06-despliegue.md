# Despliegue

## Dónde está desplegado

| Componente | Plataforma | URL | Rama de despliegue |
|---|---|---|---|
| Frontend | Vercel | <https://fe-runaways-is-2026.vercel.app/> | `main` |
| Backend | Railway | <https://runaways-api.up.railway.app/api/v1> | `main` |
| Base de datos | Railway | Privada; conexión interna desde el backend | — |

## Cómo se publica una nueva versión

El backend tiene despliegue continuo desde `main`: cada cambio integrado en esa rama inicia automáticamente una nueva versión en Railway.

1. Se desarrollan las historias en ramas `feature/<ID>-<descripcion>` y se integran en `develop` mediante Pull Requests revisados y aprobados.
2. Cuando las historias de una entrega están listas, se crea una rama `release/X.Y.Z` desde `develop`. En ella se hacen solo ajustes finales, como actualizar versiones o corregir detalles menores.
3. Se abre un Pull Request de `release/X.Y.Z` hacia `main`. Otro integrante debe aprobarlo antes de fusionarlo. La rama release también se fusiona de regreso a `develop` para mantener ambas ramas sincronizadas.
4. Se crea en GitHub la etiqueta `vX.Y.Z` sobre el commit publicado en `main`, acompañada de una lista breve de los cambios incluidos.
5. La integración en `main` activa el despliegue continuo: Railway construye y despliega el backend usando el `Dockerfile` del repositorio.
6. Durante el arranque, el contenedor ejecuta `prisma migrate deploy` para aplicar las migraciones pendientes y luego inicia la API.
7. Se comprueba que el servicio esté disponible en `https://runaways-api.up.railway.app/api/v1` y que Swagger responda en `https://runaways-api.up.railway.app/api/docs`.

Si aparece un defecto en producción, se crea una rama `hotfix/<descripcion>` desde `main`. La corrección se integra en `main` y en `develop`; se publica una nueva versión aumentando el número de parche (por ejemplo, de `v1.0.0` a `v1.0.1`). Como el frontend y el backend están en repositorios separados, cada repositorio conserva su propio flujo de publicación y etiqueta.

## Variables de entorno en producción

Las variables se configuran en el panel del servicio del backend en Railway. Se documentan solo sus nombres; sus valores y secretos no se guardan en el repositorio.

| Variable | Dónde se configura |
|---|---|
| `DATABASE_URL` | Railway, Variables del servicio backend; cadena de conexión privada a PostgreSQL |
| `JWT_SECRET` | Railway, Variables del servicio backend; secreto de al menos 32 caracteres |
| `NODE_ENV` | Railway, Variables del servicio backend |
| `JWT_EXPIRES_IN` | Railway, Variables del servicio backend; si se omite, usa el valor predeterminado de la aplicación |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | Railway, Variables del servicio backend; si se omite, usa el valor predeterminado de la aplicación |
| `BCRYPT_SALT_ROUNDS` | Railway, Variables del servicio backend; si se omite, usa el valor predeterminado de la aplicación |
| `CLOUDINARY_CLOUD_NAME` | Railway, Variables del servicio backend; configurar junto con las dos variables siguientes cuando se habilite Cloudinary |
| `CLOUDINARY_API_KEY` | Railway, Variables del servicio backend; configurar junto con las otras variables de Cloudinary |
| `CLOUDINARY_API_SECRET` | Railway, Variables del servicio backend; configurar junto con las otras variables de Cloudinary |
| `SEED_TEST_PASSWORD` | Railway, Variables del servicio backend; contraseña secreta de la cuenta de prueba utilizada durante el despliegue |
| `ADMIN_EMAIL` | Railway, Variables del servicio backend; correo utilizado por el seed de despliegue para crear o actualizar la cuenta ADMIN |
| `ADMIN_PASSWORD` | Railway, Variables del servicio backend; contraseña secreta utilizada por el seed de despliegue para crear la cuenta ADMIN |

# Despliegue del frontend

## Cómo se publica una nueva versión

El frontend tiene despliegue continuo desde `main`: cada cambio integrado en esa rama inicia automáticamente una nueva versión de producción en Vercel.

1. Se desarrollan las historias en ramas `feature/<descripcion>` desde `develop` y se integran en `develop` mediante Pull Requests revisados y aprobados por otro integrante.
2. Cuando las historias de una entrega están listas, se crea una rama `release/X.Y.Z` desde `develop`. En ella se realizan únicamente ajustes finales de la entrega.
3. Se abre un Pull Request de `release/X.Y.Z` hacia `main`. Otro integrante debe aprobarlo antes de fusionarlo. La rama release también se integra de regreso a `develop` para mantener ambas ramas sincronizadas.
4. Se crea en GitHub la etiqueta `vX.Y.Z` sobre el commit publicado en `main`, acompañada de una lista breve de los cambios incluidos.
5. La integración en `main` activa el despliegue automático de Vercel, que construye y publica el frontend.
6. Se verifica que la aplicación publicada responda en el dominio de producción asignado por Vercel (`*.vercel.app`).

Antes de integrar los cambios de la entrega, el proyecto requiere ejecutar `npm run lint`, `npm run build` y `npm test`.

## Variables de entorno en producción

| Variable | Dónde se configura |
|---|---|
| `API_URL` | Vercel, Settings → Environment Variables (Production). |
| `USE_MOCKS` | Vercel, Settings → Environment Variables (Production). |