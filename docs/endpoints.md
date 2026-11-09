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
| `GET /api/v1/auth/me` | Sesión | Sin cuerpo | `200`: usuario actual |
| `PATCH /api/v1/profile/role` | `TENANT` o `OWNER` autenticado | `{ role }` | `200`: cambio de rol y nuevos tokens |
| `GET /api/v1/properties?page=N` | `TENANT` autenticado | `page` opcional, entero positivo | `200`: catálogo paginado de bienes `AVAILABLE`, 12 por página |
| `GET /api/v1/properties/:id` | `TENANT` autenticado | `id` UUID | `200`: detalle de un bien `AVAILABLE`, arrendador, reseñas y calificaciones |
| `POST /api/v1/properties` | `OWNER` autenticado | `multipart/form-data`: datos del bien e imágenes JPG/PNG | `201`: bien creado |
| `GET /api/v1/properties/mine?page=N` | `OWNER` autenticado | `page` opcional, entero positivo | `200`: publicaciones propias `AVAILABLE` o `PAUSED`, 12 por página |
| `GET /api/v1/properties/:id/owner` | `OWNER` autenticado, dueño del bien | `id` UUID | `200`: bien propio completo para edición |
| `PUT /api/v1/properties/:id` | `OWNER` autenticado, dueño del bien | `multipart/form-data`: campos completos, `imagesToRemove` y archivos nuevos opcionales | `200`: bien actualizado con la estructura de creación |


### Validación y errores

- El `ValidationPipe` global responde `400 VALIDATION_ERROR` para datos inválidos o campos no permitidos.
- Login responde `401` con mensaje genérico para credenciales incorrectas y `429` tras exceder intentos.
- Refresh inválido, vencido o revocado responde `401`; logout es idempotente y responde `204`.
- Catálogo y `mine`: `400` si `page` no es un entero positivo; `401` sin sesión; `403` si el rol no corresponde.
- Detalle TENANT: `400` si `id` no es UUID, `401` sin sesión, `403` para otro rol y `404 PROPERTY_NOT_AVAILABLE`
  si no existe o no está `AVAILABLE`, con «Este bien no existe o no está disponible».
- Rutas de gestión OWNER: `400` para UUID o datos inválidos, `401` sin sesión, `403` si no es `OWNER` y `404`
  si el bien no existe, no está gestionable o pertenece a otro usuario.
- `PUT` responde `409 PROPERTY_PRICE_CHANGE_BLOCKED` si se intenta cambiar precio o depósito con reservas
  `PENDING` o `PAID`. El mensaje es «No se puede modificar el precio ni el depósito de un bien con reservas
  PENDIENTE O PAGADA».

## Rutas planificadas

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