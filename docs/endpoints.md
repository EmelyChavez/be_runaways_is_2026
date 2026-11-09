# Endpoints

Prefijo global: `/api/v1`. Swagger: `/api/docs`. Los ejemplos de request y response omiten campos
no relevantes. Los endpoints marcados como **implementados** corresponden a controladores que
existen actualmente en `src/`. Las rutas **planificadas** provienen del contrato de `AGENTS.md` y
aún no deben considerarse disponibles en la API.

## Implementados

| Método y ruta | Acceso | Request | Respuesta exitosa |
|---|---|---|---|
| `GET /api/v1/` | Público | Sin cuerpo | `200`, texto `Hello World!` |
| `POST /api/v1/auth/register` | Público | `{ "name", "email", "password" }` | `201`: `{ id, email, role, name }` |
| `POST /api/v1/auth/login` | Público | `{ "email", "password" }` | `200`: `{ accessToken, refreshToken, expiresIn, user }` |
| `POST /api/v1/auth/refresh` | Refresh token en el cuerpo | `{ "refreshToken" }` | `200`: nuevo par de tokens y usuario |
| `POST /api/v1/auth/logout` | Refresh token en el cuerpo | `{ "refreshToken" }` | `204`, sin cuerpo |
| `GET /api/v1/auth/me` | Bearer access token | Sin cuerpo | `200`: `{ id, email, role, isActive, createdAt }` |
| `PATCH /api/v1/profile/role` | `TENANT` o `OWNER` autenticado | `{ "role": "TENANT" }` o `{ "role": "OWNER" }` | `200`: `{ userId, previousRole, role, changedAt, accessToken, refreshToken, expiresIn }` |
| `POST /api/v1/properties` | `OWNER` autenticado | `multipart/form-data`: campos del bien e `images` (1–5 archivos JPG/PNG, máximo 5 MB cada uno) | `201`: bien creado con URLs HTTPS de Cloudinary en `images` |
| `GET /api/v1/properties?page=N` | `TENANT` autenticado | `page` opcional, entero desde 1 (por defecto 1) | `200`: `{ data: [{ id, title, municipality, department, category, pricePerDay, images }], total, page, pageSize: 12 }`; bienes `AVAILABLE`, más recientes primero |

### Validación y errores de los endpoints implementados

- El `ValidationPipe` global responde `400` con código `VALIDATION_ERROR` si el cuerpo incumple
  validaciones o incluye propiedades no permitidas.
- Registro responde `409` si el email ya está registrado.
- Login responde `401` con el mismo mensaje genérico para correo inexistente y contraseña errónea;
  tras cinco fallos en la ventana definida responde `429`. Contraseña correcta para cuenta
  deshabilitada responde `403`.
- Refresh inválido, vencido o revocado responde `401`. Logout es idempotente y responde `204`.
- `/auth/me` responde `401` sin access token válido.
- Catálogo: `400 VALIDATION_ERROR` si `page` no es un entero positivo; `401` sin sesión. Si no hay bienes disponibles, responde `200` con `data: []` y `total: 0`.
- Cambio de rol: `401` sin sesión; `403` si la cuenta no está verificada al pasar a `OWNER` o si es
  `ADMIN`; `409 ROLE_UNCHANGED` si se solicita el mismo rol y `409 ROLE_CHANGE_BLOCKED` si hay
  reservas `PENDING`/`PAID` o depósitos `PENDING` que bloquean el cambio. Rol fuera de `TENANT` y
  `OWNER` responde `400 VALIDATION_ERROR`.

Las respuestas de usuario no incluyen `passwordHash`. El backend devuelve tokens en JSON y no
establece una cookie HTTP.

## Rutas planificadas en `AGENTS.md`

Estas rutas forman parte del contrato previsto del producto, pero sus módulos aún no tienen
controladores implementados en el backend actual.

| Área | Rutas | Acceso previsto |
|---|---|---|
| Verificación | `GET /api/v1/admin/verifications`; `PATCH /api/v1/admin/verifications/:userId/approve`; `PATCH /api/v1/admin/verifications/:userId/reject` | `ADMIN` |
| Bienes | `GET /api/v1/properties`; `GET /api/v1/properties/:id`; `GET /api/v1/properties/:id/availability`; `GET /api/v1/properties/mine`; `GET /api/v1/properties/:id/owner`; `PUT /api/v1/properties/:id`; `PATCH /api/v1/properties/:id/status`; `DELETE /api/v1/properties/:id` | Según `AGENTS.md`: `OWNER`, `TENANT` o ambos; algunas requieren ser propietario del bien |
| Bloqueos de fechas | `POST /api/v1/properties/:id/blocks`; `GET /api/v1/properties/:id/blocks`; `DELETE /api/v1/blocks/:id` | `OWNER` dueño |
| Reservas y pagos | `POST /api/v1/bookings`; `GET /api/v1/bookings/mine`; `GET /api/v1/owner/bookings`; `POST /api/v1/payments`; `POST /api/v1/bookings/:id/deposit/decision` | `TENANT`, `OWNER` dueño según ruta |
| Reseñas | `POST /api/v1/reservations/:id/reviews/property`; `POST /api/v1/reservations/:id/reviews/renter` | `TENANT` o `OWNER` |
| Mensajería | `GET /api/v1/conversations`; `GET /api/v1/conversations/:id/messages`; `POST /api/v1/conversations/:id/messages` | Sesión; mensajes limitados a participantes |
| Notificaciones | `POST /api/v1/notifications/internal`; `GET /api/v1/notifications`; `GET /api/v1/notifications/unread-count`; `PATCH /api/v1/notifications/:id/read`; `PATCH /api/v1/notifications/read-all` | Servicio interno o sesión según ruta |
| Reportes del arrendador | `GET /api/v1/owner/reports/income`; `GET /api/v1/owner/reports/income/by-property`; `GET /api/v1/owner/reports/ratings`; `GET /api/v1/owner/reports/occupancy` | `OWNER` |

Los parámetros de consulta y respuestas de estas rutas se documentarán en esta tabla al implementar
cada historia, siguiendo su card y los criterios de aceptación.
