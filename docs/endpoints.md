# Endpoints

Prefijo global: `/api/v1`. Swagger: `/api/docs`. Las rutas implementadas corresponden a controladores
existentes en `src/`; las planificadas aún no tienen controlador.

## Implementados

El servicio interno de notificaciones de H22 se invoca mediante `NotificationsService.emit` desde
otros módulos del backend. Los eventos con plantilla generan el título y mensaje unificados; los
avisos sin plantilla usan los textos proporcionados. La notificación se crea como `UNREAD` y el
destinatario inexistente produce `404 RECIPIENT_NOT_FOUND`. H23 expone la bandeja para la sesión
actual; los endpoints nunca reciben el destinatario desde el cliente.

| Método y ruta | Acceso | Request | Respuesta exitosa |
|---|---|---|---|
| `GET /api/v1/` | Público | Sin cuerpo | `200`, texto `Hello World!` |
| `GET /api/v1/notifications` | Sesión (`TENANT` o `OWNER`) | `page` opcional (1); `limit` opcional (10, máximo 100) | `200`: `{ data, total, page, limit, totalPages }`, en orden descendente de emisión |
| `GET /api/v1/notifications/unread-count` | Sesión (`TENANT` o `OWNER`) | Sin parámetros | `200`: `{ unreadCount }` |
| `PATCH /api/v1/notifications/:id/read` | Sesión (`TENANT` o `OWNER`) | `id` UUID | `200`: notificación actualizada a `READ`; `403` si pertenece a otro usuario o el rol no está permitido, `404` si no existe |
| `PATCH /api/v1/notifications/read-all` | Sesión (`TENANT` o `OWNER`) | Sin parámetros | `200`: `{ updatedCount }` |
| `POST /api/v1/auth/register` | Público | `{ name, email, password }` | `201`: `{ id, email, role, name }` |
| `POST /api/v1/auth/login` | Público | `{ email, password }` | `200`: `{ accessToken, refreshToken, expiresIn, user }` |
| `POST /api/v1/auth/refresh` | Refresh token en el cuerpo | `{ refreshToken }` | `200`: nuevo par de tokens y usuario |
| `POST /api/v1/auth/logout` | Refresh token en el cuerpo | `{ refreshToken }` | `204`, sin cuerpo |
| `GET /api/v1/auth/me` | Bearer access token | Sin cuerpo | `200`: `{ id, email, role, isActive, createdAt }` |
| `PATCH /api/v1/profile/role` | `TENANT` o `OWNER` autenticado | `{ role }` | `200`: datos del cambio y nuevo par de tokens |
| `GET /api/v1/properties/:id` | `TENANT` autenticado | `id` UUID | `200`: detalle del bien disponible, arrendador, reseñas y calificaciones |
| `GET /api/v1/properties/:id/availability` | `TENANT` autenticado o `OWNER` dueño | `id` UUID | `200`: `{ propertyId, from, to, occupiedDates }`; fechas ISO `YYYY-MM-DD`, desde hoy hasta el día 90 inclusive |
| `POST /api/v1/bookings` | `TENANT` autenticado y verificado | `{ propertyId, startDate, endDate }` (`YYYY-MM-DD`) | `201`: reserva `PENDING`, subtotal calculado, `expiresAt` y mensaje de confirmación |
| `GET /api/v1/bookings/mine` | `TENANT` autenticado | `status` opcional, `page` (1), `pageSize` (10, máximo 100) | `200`: `{ data, total, page }`; solo reservas del arrendatario autenticado |
| `GET /api/v1/owner/bookings` | `OWNER` autenticado | `propertyId` y `status` opcionales, `page` (1), `pageSize` (10, máximo 100) | `200`: `{ data, total, page }`; solo reservas de bienes del arrendador, incluyendo `tenant.name` |
| `PATCH /api/v1/profile/role` | `TENANT` o `OWNER` autenticado | `{ "role": "TENANT" }` o `{ "role": "OWNER" }` | `200`: `{ userId, previousRole, role, changedAt, accessToken, refreshToken, expiresIn }` |
| `POST /api/v1/profile/document` | `TENANT` autenticado | `multipart/form-data`: `documentType` (`DUI`/`PASSPORT`), `documentNumber`, `documentUrl` como archivo JPG/PNG/PDF (máximo 5 MB) | `201`: `{ documentType, documentStatus: "PENDING", documentSubmittedAt }` |
| `GET /api/v1/profile/document` | `TENANT` o `OWNER` autenticado | Sin parámetros | `200`: `{ accountStatus: UNVERIFIED/PENDING/VERIFIED/REJECTED, documentType?, documentSubmittedAt?, rejectionReason? }`; sin URL ni número del documento |
| `GET /api/v1/profile/document/admin` | `ADMIN` | Query opcional: `page` (1), `pageSize` (10, máximo 100) | `200`: `{ data: [{ userId, name, email, documentType, documentNumber, documentSubmittedAt }], total, page, pageSize }`; solo documentos `PENDING`, en orden ascendente por envío |
| `GET /api/v1/profile/document/admin/:userId` | `ADMIN` | `userId` UUID | `200`: detalle del documento `PENDING` y `documentUrl` temporal para abrir el archivo privado; `404` si no existe o ya fue revisado |
| `PATCH /api/v1/profile/document/admin/:userId/approve` | `ADMIN` | `userId` UUID | `200`: `{ userId, documentStatus: "APPROVED", isVerified: true, reviewedAt }` |
| `PATCH /api/v1/profile/document/admin/:userId/reject` | `ADMIN` | `userId` UUID; `{ rejectionReason }` de 10 a 300 caracteres | `200`: `{ userId, documentStatus: "REJECTED", rejectionReason, reviewedAt }` |
| `POST /api/v1/properties` | `OWNER` autenticado | `multipart/form-data`: campos del bien e `images` (1–5 archivos JPG/PNG, máximo 5 MB cada uno) | `201`: bien creado con URLs HTTPS de Cloudinary en `images` |
| `GET /api/v1/properties` | `TENANT` autenticado | `page` opcional (por defecto 1); `q` busca sin distinguir mayúsculas ni tildes en título, descripción, departamento, municipio y dirección; `department` puede enviarse solo y `municipality` requiere `department`; permite `category`, `noDeposit=true` (depósito igual a cero), límites de precio y `startDate`/`endDate` juntos | `200`: `{ data: [{ id, title, municipality, department, category, pricePerDay, images }], total, page, pageSize: 12 }`; solo bienes `AVAILABLE`, criterios combinados con AND, más recientes primero |
| `PATCH /api/v1/properties/:id/status` | `OWNER` autenticado, dueño | `id` UUID; `{ "status": "AVAILABLE" | "PAUSED" }` | `200`: `{ id, status, statusChangedAt }`; bloqueado si hay reservas `PENDING` o `PAID` |
| `DELETE /api/v1/properties/:id` | `OWNER` autenticado, dueño | `id` UUID | `204`, sin cuerpo; cambia el estado a `DELETED` y conserva las reseñas |

### Validación y errores de los endpoints implementados

- El `ValidationPipe` global responde `400` con código `VALIDATION_ERROR` si el cuerpo incumple
  validaciones o incluye propiedades no permitidas.
- Registro responde `409` si el email ya está registrado.
- Login responde `401` con el mismo mensaje para correo inexistente y contraseña errónea; tras cinco
  fallos en la ventana definida responde `429`. Una cuenta deshabilitada responde `403`.
- Refresh inválido, vencido o revocado responde `401`. Logout es idempotente y responde `204`.
- `/auth/me` responde `401` sin access token válido.
- Notificaciones: todas las rutas requieren sesión. La bandeja y el contador solo consultan registros
  de la identidad autenticada; marcar una notificación ajena responde `403`, y un ID inexistente
  responde `404`. La página debe ser un entero positivo y el límite entre 1 y 100; por defecto es 10.
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
- Disponibilidad (H9): `400` si `id` no es UUID, `401` sin sesión y `403` para roles distintos de
  `TENANT` y `OWNER`. `OWNER` solo puede consultar bienes propios. Responde `404 PROPERTY_NOT_AVAILABLE`
  y «Este bien ya no está disponible» cuando el bien no existe, está `PAUSED`/`DELETED` o no pertenece
  al arrendador autenticado. `occupiedDates` combina días de reservas `PENDING`/`PAID` y bloqueos del
  arrendador dentro de los 90 días desde hoy en El Salvador; no incluye datos de quién reservó.
- Reservas (H10): `POST /api/v1/bookings` responde `400 VALIDATION_ERROR` para fechas inválidas,
  fecha final anterior, fechas fuera de los próximos 90 días o periodos mayores de 30 días; `401`
  sin sesión; `403` para roles distintos de `TENANT` o perfil sin verificar; `404 PROPERTY_NOT_AVAILABLE`
  si el bien no existe o no está `AVAILABLE`; y `409 DATES_UNAVAILABLE` si una reserva activa o un
  bloqueo se traslapa. La comprobación y creación se ejecutan en una transacción serializable. La
  reserva se guarda como `PENDING`, vence 24 horas después y responde el subtotal calculado por el
  servidor junto con «Reserva creada. Tienes 24 horas para pagarla.».
- `GET /api/v1/bookings/mine` y `GET /api/v1/owner/bookings` requieren respectivamente `TENANT` y
  `OWNER`; los resultados siempre se limitan al usuario de sesión. Ambos aceptan estado y paginación;
  la ruta del arrendador admite además `propertyId` y muestra el nombre del arrendatario.
- Gestión de publicaciones: el cambio de estado solo acepta `AVAILABLE` o `PAUSED`; `400` para
  estado o UUID inválido, `401` sin sesión, `403` para rol distinto de `OWNER`, `404` si el bien no
  existe o pertenece a otro usuario y `409` si está `DELETED` o tiene reservas `PENDING`/`PAID`.
  Ambas operaciones validan y escriben en transacciones serializables. El borrado es lógico y
  conserva las reseñas; catálogo, detalle público y Mis publicaciones omiten publicaciones eliminadas.
- Cambio de rol: `401` sin sesión; `403` si la cuenta no está verificada al pasar a `OWNER` o si es
  `ADMIN`; `409 ROLE_UNCHANGED` si se solicita el mismo rol y `409 ROLE_CHANGE_BLOCKED` si hay
  reservas `PENDING`/`PAID` o depósitos `PENDING` que bloquean el cambio. Rol fuera de `TENANT` y
  `OWNER` responde `400 VALIDATION_ERROR`.

Las respuestas de usuario no incluyen `passwordHash`. El backend devuelve tokens en JSON y no
establece una cookie HTTP.

### Filtro de disponibilidad del catálogo

`GET /api/v1/properties` acepta `startDate` y `endDate` juntos en formato `YYYY-MM-DD`. El rango debe comenzar
hoy o después, no puede superar 30 días inclusivos ni terminar después de los próximos 90 días. Los resultados
excluyen propiedades con reservas `PAID`, reservas `PENDING` cuyo plazo de pago no haya vencido o bloqueos del
arrendador que se traslapen con el periodo. Reservas `CANCELED`, `COMPLETED` y `PENDING` vencidas no ocupan fechas.

## Rutas planificadas en `AGENTS.md`

| Área | Rutas | Acceso previsto |
|---|---|---|
| Verificación | Implementada en la tabla de endpoints con rutas `/api/v1/profile/document/admin` | `ADMIN` |
| Bienes | `PATCH /api/v1/properties/:id/status`; `DELETE /api/v1/properties/:id` | `OWNER` dueño |
| Bloqueos de fechas | `POST /api/v1/properties/:id/blocks`; `GET /api/v1/properties/:id/blocks`; `DELETE /api/v1/blocks/:id` | `OWNER` dueño |
| Reservas y pagos | `POST /api/v1/bookings`; `GET /api/v1/bookings/mine`; `GET /api/v1/owner/bookings`; `POST /api/v1/payments`; `POST /api/v1/bookings/:id/deposit/decision` | `TENANT` o `OWNER` dueño según ruta |
| Reseñas | `POST /api/v1/reservations/:id/reviews/property`; `POST /api/v1/reservations/:id/reviews/renter` | `TENANT` o `OWNER` |
| Mensajería | `GET /api/v1/conversations`; `GET /api/v1/conversations/:id/messages`; `POST /api/v1/conversations/:id/messages` | Sesión; mensajes limitados a participantes |
| Notificaciones | `NotificationsService.emit` (función interna); `GET /api/v1/notifications`; `GET /api/v1/notifications/unread-count`; `PATCH /api/v1/notifications/:id/read`; `PATCH /api/v1/notifications/read-all` | Servicio interno o sesión |
| Reportes del arrendador | `GET /api/v1/owner/reports/income`; `GET /api/v1/owner/reports/income/by-property`; `GET /api/v1/owner/reports/ratings`; `GET /api/v1/owner/reports/occupancy` | `OWNER` |
| Reportes del arrendador | `GET /api/v1/owner/reports/income`; `GET /api/v1/owner/reports/income/by-property`; `GET /api/v1/owner/reports/ratings`; `GET /api/v1/owner/reports/occupancy` | `OWNER` |

Los parámetros y respuestas de las rutas planificadas se documentarán al implementar cada historia.

