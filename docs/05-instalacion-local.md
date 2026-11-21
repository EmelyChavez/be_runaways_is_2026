# Instalación local

Esta guía prepara PostgreSQL y el backend para desarrollo local. Se puede ejecutar la API desde
Node.js o levantar API y base de datos juntas con Docker Compose.

## Requisitos

- Git para clonar el repositorio.
- Docker Desktop con Docker Compose v2 para ejecutar PostgreSQL o el stack completo.
- Node.js 24 y npm para instalar dependencias, ejecutar migraciones, cargar el seed o correr la API
  fuera del contenedor. La imagen del backend usa `node:24-alpine`.
- Puerto `5432` disponible para PostgreSQL y puerto `3000` disponible para la API, salvo que se
  cambien en `.env`.

## 1. Obtener el proyecto y configurar el entorno

Clona el repositorio del backend desde la URL compartida por el equipo y entra en la carpeta del
proyecto:

```bash
cd be_runaways_is_2026
```

Copia `.env.example` como `.env` y configura `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y
`SEED_TEST_PASSWORD`. Usa un secreto largo y aleatorio para JWT y contraseñas seguras para las
cuentas. `SEED_TEST_PASSWORD` será la contraseña de las cuentas de prueba. No subas `.env` al
repositorio.

```bash
cp .env.example .env
```

En PowerShell, el equivalente es:

```powershell
Copy-Item .env.example .env
```

El `.env.example` incluye valores de desarrollo para PostgreSQL, URL de conexión, puertos y tiempos
de expiración de tokens. Reemplaza los valores de ejemplo antes de usar el entorno.

## 2. Instalar dependencias

Desde la raíz del repositorio:

```bash
npm ci
```

El proceso de instalación genera el cliente de Prisma mediante el script `postinstall`.

## Opción A: ejecutar la API desde Node.js y PostgreSQL en Docker

Esta modalidad es útil para desarrollar la API con recarga automática:

1. Inicia únicamente la base de datos:

   ```bash
   docker compose up -d postgres
   ```

2. Aplica las migraciones locales:

   ```bash
   npm run prisma:migrate
   ```

3. Carga el seed descrito en la sección [Datos semilla](#datos-semilla):

   ```bash
   npm run db:seed
   ```

4. Arranca el backend en modo desarrollo:

   ```bash
   npm run start:dev
   ```

La API queda disponible en `http://localhost:3000/api/v1` y Swagger en
`http://localhost:3000/api/docs`.

## Opción B: ejecutar API y PostgreSQL con Docker Compose

Desde la raíz del proyecto:

```bash
docker compose up -d --build
```

Compose inicia PostgreSQL, espera a que pase su health check y luego arranca la API. El contenedor de
la API aplica las migraciones pendientes antes de iniciar el servidor. Para cargar el seed, ejecuta
`npm run db:seed` desde la máquina local; el `.env` de ejemplo conecta a la base publicada en
`localhost:5432`.

Los comandos útiles para administrar el entorno son:

```bash
docker compose ps
docker compose logs -f api
docker compose down
```

La API y Swagger quedan disponibles en las mismas direcciones que en la opción A. `docker compose
down` detiene los contenedores y conserva el volumen de PostgreSQL; no uses `docker compose down -v`
si quieres conservar esos datos.

## Datos semilla

El repositorio incluye `prisma/seed.ts`, configurado mediante `npm run db:seed`. El script crea o
actualiza la cuenta administradora, usuarios de prueba `TENANT` y `OWNER` con distintos estados de
verificación, publicaciones, bloqueos, reservas, pagos, depósitos, reseñas, conversaciones, mensajes
y notificaciones. Así se pueden recorrer los módulos sin cargar todos los datos desde cero.

Las cuentas de prueba comparten la contraseña configurada en `SEED_TEST_PASSWORD`:

- `owner.demo@runaways.test` y `owner.second@runaways.test`: cuentas `OWNER` verificadas.
- `tenant.verified@runaways.test`: `TENANT` verificada, sin reservas de ejemplo para probar el cambio
  de rol.
- `tenant.demo@runaways.test`: `TENANT` verificado con historial de reservas y actividad de ejemplo.
- `tenant.pending@runaways.test`: `TENANT` con documento pendiente de revisión.
- `tenant.rejected@runaways.test`: `TENANT` con documento rechazado.
- La cuenta `ADMIN` utiliza `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

Prisma y PostgreSQL generan los IDs de las cuentas y los datos relacionados. Ejecuta el seed una sola
vez por base de datos para cargar el conjunto de prueba. Si ya encuentra las seis cuentas de prueba,
no vuelve a crear los datos; repara las notificaciones semilla de reserva y verificación y termina.
Si solo encuentra parte de las cuentas, se detiene para evitar duplicados y conviene revisar la base
antes de continuar.
Si Cloudinary está configurado, el seed carga allí una imagen de casa para las propiedades, una
imagen de cámara para los equipos y documentos PDF de ejemplo para probar la revisión administrativa; para que estos archivos queden
en la cuenta del proyecto, configura las tres credenciales de Cloudinary. Sin credenciales, la foto
de casa se referencia desde Unsplash y los documentos conservan una URL placeholder: los datos y
estados se crean, pero no se podrá previsualizar el documento hasta configurarlo y cargarlo.

El mismo script se puede ejecutar en local y en el ambiente desplegado. En Railway, configura
`DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `SEED_TEST_PASSWORD` para ese ambiente y ejecuta
`npm run db:seed` desde un entorno con acceso de red a la base. Confirma que `DATABASE_URL` apunte al
ambiente deseado: el script crea y actualiza sus cuentas y registros semilla.

## Variables principales

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL. Desde el host local apunta a `localhost`; Compose la reemplaza dentro del contenedor para usar el servicio `postgres`. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales y nombre de la base que crea el contenedor local. |
| `POSTGRES_PORT` | Puerto local publicado para PostgreSQL (por defecto `5432`). |
| `PORT` | Puerto HTTP de la API (por defecto `3000`). |
| `JWT_SECRET` | Secreto requerido para firmar y verificar los JWT. |
| `JWT_EXPIRES_IN` | Duración del access token (por defecto `15m`). |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | Duración del refresh token en días (por defecto `7`). |
| `BCRYPT_SALT_ROUNDS` | Costo de bcrypt (por defecto `12`). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credenciales que usa `prisma/seed.ts` para crear o actualizar la cuenta `ADMIN`. |
| `SEED_TEST_PASSWORD` | Contraseña común asignada a las cuentas de prueba del seed. |

Cloudinary es necesario para probar las cargas de imágenes y documentos. Sus credenciales se
configuran en `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`; los módulos
que no cargan archivos pueden ejecutarse sin esas credenciales.

## Comprobación de la API

Abre `http://localhost:3000/api/docs` para explorar las rutas en Swagger. También se puede comprobar
la ruta de salud con:

```bash
curl http://localhost:3000/api/v1/
```

Debe responder `Hello World!` cuando la API está levantada.
