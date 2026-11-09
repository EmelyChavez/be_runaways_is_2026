# Decisiones técnicas

Este documento registra patrones del proyecto y el motivo de usarlos. Las rutas y reglas completas
están en [endpoints.md](./endpoints.md) y [flujos-autenticacion.md](./flujos-autenticacion.md).

## Servicios y repositorios

Los servicios contienen reglas de negocio y coordinan casos de uso. Los repositorios aíslan Prisma
y concentran consultas, escrituras y transacciones. Los controladores se limitan al contrato HTTP.
Esto permite mantener reglas fuera de los controladores y probar los servicios sin acoplarlos al
formato de consultas de Prisma.

## Autenticación y transporte de sesión

El backend conserva JWT Bearer porque es el contrato que implementa actualmente. El access token es
corto y el refresh token es opaco, rotado y guardado en la base únicamente mediante SHA-256. El
frontend Next.js, en una ruta de servidor, conserva el par en una cookie `HttpOnly`; el backend no
emite `Set-Cookie`. Esto deja el token fuera del JavaScript del navegador y mantiene el backend
responsable de validar cada solicitud.

## Protección por defecto

`JwtAuthGuard` es global; solo rutas marcadas con `@Public()` se omiten. `Roles` agrega metadata y
`RolesGuard` compara esa lista con el rol del usuario que cargó el guard JWT. El decorador declara
permisos y el guard los aplica.

## Protección contra intentos de login

El limitador usa un HMAC del correo normalizado para identificar intentos sin guardar el email en
claro en `login_attempts`. Las reglas de 5 intentos, ventana de 15 minutos y bloqueo por 15 minutos
pertenecen a `LoginRateLimitService`; `LoginAttemptRepository` gestiona la persistencia en una
transacción. Para cuentas inexistentes se realiza una comparación bcrypt con un hash descartable,
reduciendo diferencias de tiempo sin afirmar que todas las respuestas duran exactamente lo mismo.

## Cambio de rol atómico

Las comprobaciones de reservas y depósitos, el cambio de rol y la pausa de bienes `AVAILABLE` se
agrupan en una transacción serializable para evitar que una solicitud concurrente deje datos
inconsistentes. El servidor toma el usuario autenticado del JWT/guard, no de un identificador
enviado por el cliente.

## Validación de entrada

El `ValidationPipe` global transforma DTOs, elimina la posibilidad de ignorar campos desconocidos
(los rechaza) y normaliza errores de validación como `400 VALIDATION_ERROR`. El registro no acepta
un rol enviado por cliente; el servidor siempre asigna `TENANT`.

## Imágenes de propiedades en Cloudinary

La creación de propiedades recibe `multipart/form-data` con entre una y cinco imágenes JPG o PNG,
de hasta 5 MB cada una. El backend valida MIME y firma del archivo, sube las imágenes a la carpeta
`runaways/properties` de Cloudinary y almacena en `Property.images` únicamente sus URLs HTTPS. Las
credenciales se leen de `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`;
si la carga o el guardado del bien falla, se eliminan las imágenes subidas durante esa solicitud.
Las credenciales no son necesarias para arrancar otros módulos, pero sí para publicar un bien.

## Prisma y PostgreSQL

El proyecto usa Prisma como ORM y PostgreSQL como base. `PrismaService` configura el driver adapter
de PostgreSQL en tiempo de ejecución, acorde con Prisma 7. Los repositorios inyectan ese servicio;
los controladores no acceden directamente a la base.
