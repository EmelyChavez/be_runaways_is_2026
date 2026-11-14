# Endpoints

Prefijo global: `/api/v1`. Swagger: `/api/docs`. Las rutas implementadas corresponden a controladores
existentes en `src/`; las planificadas aún no tienen controlador.

## Implementados

| Método y ruta | Acceso | Request | Respuesta exitosa |
|---|---|---|---|
| `GET /api/v1/` | Público | Sin cuerpo | `200`, texto `Hello World!` |
| `POST /api/v1/auth/register` | Público | `{ name, email, password }` | `201`: `{ id, email, role, name }` |
| `POST /api/v1/auth/login` | Público | `{ email, password }` | `200`: `{ accessToken, refreshToken, expiresIn, user }` |
| `POST /api/v1/auth/refresh` | Refresh token en el cuerpo | `{ refreshToken }` | `200`: nuevo par de tokens y usuario |
| `POST /api/v1/auth/logout` | Refresh token en el cuerpo | `{ refreshToken }` | `204`, sin cuerpo |
| `GET /api/v1/auth/me` | Bearer access token | Sin cuerpo | `200`: `{ id, email, role, isActive, createdAt }` |
| `PATCH /api/v1/profile/role` | `TENANT` o `OWNER` autenticado | `{ role }` | `200`: datos del cambio y nuevo par de tokens |
| `GET /api/v1/properties` | `TENANT` autenticado | Query opcionales: `page`, `q` (2–100 caracteres), `department`, `municipality`, `category` (`PROPERTY`/`EQUIPMENT`), `noDeposit` (`true`/`false`), `minPrice` y `maxPrice` (0.01–9999.99) | `200`: catálogo paginado filtrado por todos los criterios indicados; solo bienes `AVAILABLE` |
| `GET /api/v1/properties/:id` | `TENANT` autenticado | `id` UUID | `200`: detalle del bien disponible, arrendador, reseñas y calificaciones |
| `PATCH /api/v1/profile/role` | `TENANT` o `OWNER` autenticado | `{ "role": "TENANT" }` o `{ "role": "OWNER" }` | `200`: `{ userId, previousRole, role, changedAt, accessToken, refreshToken, expiresIn }` |
| `POST /api/v1/properties` | `OWNER` autenticado | `multipart/form-data`: campos del bien e `images` (1–5 archivos JPG/PNG, máximo 5 MB cada uno) | `201`: bien creado con URLs HTTPS de Cloudinary en `images` |
| `GET /api/v1/properties` | `TENANT` autenticado | `page` opcional (por defecto 1); `q` busca sin distinguir mayúsculas ni tildes en título, descripción, departamento, municipio y dirección; `department` puede enviarse solo y `municipality` requiere `department`; permite `category`, `noDeposit=true` (depósito igual a cero), y límites de precio | `200`: `{ data: [{ id, title, municipality, department, category, pricePerDay, images }], total, page, pageSize: 12 }`; solo bienes `AVAILABLE`, criterios combinados con AND, más recientes primero |

### Validación y errores de los endpoints implementados

- El `ValidationPipe` global responde `400` con código `VALIDATION_ERROR` si el cuerpo incumple
  validaciones o incluye propiedades no permitidas.
- Registro responde `409` si el email ya está registrado.
- Login responde `401` con el mismo mensaje para correo inexistente y contraseña errónea; tras cinco
  fallos en la ventana definida responde `429`. Una cuenta deshabilitada responde `403`.
- Refresh inválido, vencido o revocado responde `401`. Logout es idempotente y responde `204`.
- `/auth/me` responde `401` sin access token válido.
- Catálogo: `400 VALIDATION_ERROR` si `page` no es un entero positivo, `q` tiene menos de 2 o más de 100 caracteres, `category` o `noDeposit` son inválidos, un precio es inválido o
  `minPrice` es mayor que `maxPrice`; `401` sin sesión. Se puede enviar solo uno de los límites.
  Los límites son inclusivos. La búsqueda textual ignora mayúsculas y tildes; la búsqueda textual y
  cada filtro se combinan. Los filtros de departamento y municipio comparan el valor completo,
  ignorando mayúsculas. `noDeposit=true` busca
  publicaciones con `securityDeposit` igual a `0.00`. Sin bienes disponibles que coincidan responde
  `200` con `data: []` y `total: 0` (el cliente muestra «No se encontraron resultados»).
- Detalle: `400` si `id` no es UUID, `401` sin sesión y `403` para roles distintos de `TENANT`.
  Responde `404 PROPERTY_NOT_AVAILABLE` si el bien no existe o no está `AVAILABLE`, con el mensaje
  «Este bien no existe o no está disponible».
- Cambio de rol: `401` sin sesión; `403` si la cuenta no está verificada al pasar a `OWNER` o si es
  `ADMIN`; `409 ROLE_UNCHANGED` si se solicita el mismo rol y `409 ROLE_CHANGE_BLOCKED` si hay
  reservas `PENDING`/`PAID` o depósitos `PENDING` que bloquean el cambio. Rol fuera de `TENANT` y
  `OWNER` responde `400 VALIDATION_ERROR`.

Las respuestas de usuario no incluyen `passwordHash`. El backend devuelve tokens en JSON y no
establece una cookie HTTP.

## Rutas planificadas en `AGENTS.md`

| Área | Rutas | Acceso previsto |
|---|---|---|
| Verificación | `GET /api/v1/admin/verifications`; `PATCH /api/v1/admin/verifications/:userId/approve`; `PATCH /api/v1/admin/verifications/:userId/reject` | `ADMIN` |
| Bienes | `GET /api/v1/properties/:id/availability`; `PATCH /api/v1/properties/:id/status`; `DELETE /api/v1/properties/:id` | `TENANT`, `OWNER` o dueño según ruta |
| Bloqueos de fechas | `POST /api/v1/properties/:id/blocks`; `GET /api/v1/properties/:id/blocks`; `DELETE /api/v1/blocks/:id` | `OWNER` dueño |
| Reservas y pagos | `POST /api/v1/bookings`; `GET /api/v1/bookings/mine`; `GET /api/v1/owner/bookings`; `POST /api/v1/payments`; `POST /api/v1/bookings/:id/deposit/decision` | `TENANT` o `OWNER` dueño según ruta |
| Reseñas | `POST /api/v1/reservations/:id/reviews/property`; `POST /api/v1/reservations/:id/reviews/renter` | `TENANT` o `OWNER` |
| Mensajería | `GET /api/v1/conversations`; `GET /api/v1/conversations/:id/messages`; `POST /api/v1/conversations/:id/messages` | Sesión; mensajes limitados a participantes |
| Notificaciones | `POST /api/v1/notifications/internal`; `GET /api/v1/notifications`; `GET /api/v1/notifications/unread-count`; `PATCH /api/v1/notifications/:id/read`; `PATCH /api/v1/notifications/read-all` | Servicio interno o sesión |
| Reportes del arrendador | `GET /api/v1/owner/reports/income`; `GET /api/v1/owner/reports/income/by-property`; `GET /api/v1/owner/reports/ratings`; `GET /api/v1/owner/reports/occupancy` | `OWNER` |
| Notificaciones | `POST /api/v1/notifications/internal`; `GET /api/v1/notifications`; `GET /api/v1/notifications/unread-count`; `PATCH /api/v1/notifications/:id/read`; `PATCH /api/v1/notifications/read-all` | Servicio interno o sesión según ruta |
| Reportes del arrendador | `GET /api/v1/owner/reports/income`; `GET /api/v1/owner/reports/income/by-property`; `GET /api/v1/owner/reports/ratings`; `GET /api/v1/owner/reports/occupancy` | `OWNER` |

Los parámetros y respuestas de las rutas planificadas se documentarán al implementar cada historia.
