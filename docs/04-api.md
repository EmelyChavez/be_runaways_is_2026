# API

API REST del backend Runaways. El prefijo de las rutas es `/api/v1` y la documentación interactiva
está disponible en [Swagger](https://runaways-api.up.railway.app/api/docs#/).

## Autenticación

Las rutas protegidas reciben `Authorization: Bearer <accessToken>`. El access token JWT dura 15
minutos e incluye la identidad y el rol de la sesión. El refresh token dura hasta 7 días y se envía
en el cuerpo de las rutas de renovación y cierre de sesión. El backend responde los tokens en JSON y
no establece cookies; el frontend Next.js conserva el par en una cookie `HttpOnly` desde una ruta de
servidor.

Las rutas públicas no requieren sesión. Los endpoints que muestran `TENANT`, `OWNER` o `ADMIN`
requieren ese rol activo. Si no se indica propiedad en la tabla, el backend restringe los datos a la
cuenta autenticada cuando corresponde.

## Endpoints por módulo

Las tablas siguientes incluyen rutas implementadas documentadas en `endpoints.md`. Las rutas
planificadas no se presentan como disponibles.

### Módulo 0: Autenticación y cuentas (H28, H29)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Crea una cuenta y su perfil con rol inicial `TENANT`. | Público |
| POST | `/api/v1/auth/login` | Inicia sesión y devuelve access y refresh tokens. | Público |
| POST | `/api/v1/auth/refresh` | Rota el refresh token y devuelve un nuevo par. | Refresh token en el cuerpo |
| POST | `/api/v1/auth/logout` | Revoca el refresh token de la sesión. | Refresh token en el cuerpo |
| GET | `/api/v1/auth/me` | Devuelve la cuenta de la sesión actual. | Sesión |
| GET | `/api/v1/profile` | Consulta el perfil propio, estado de verificación y calificación. | `TENANT`, `OWNER`, `ADMIN` |
| PATCH | `/api/v1/profile/role` | Cambia entre `TENANT` y `OWNER` si cumple las reglas del sistema. | `TENANT`, `OWNER` |

### Módulo 1: Catálogo de propiedades/equipo (H1, H2, H3, H4, H5)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/v1/properties` | Publica un bien con sus imágenes. | `OWNER` |
| GET | `/api/v1/properties/:id` | Consulta el detalle de un bien disponible. | `TENANT` |
| PATCH | `/api/v1/properties/:id/status` | Cambia el estado del bien entre `AVAILABLE` y `PAUSED`. | `OWNER` dueño |
| DELETE | `/api/v1/properties/:id` | Marca el bien propio como eliminado. | `OWNER` dueño |

### Módulo 2: Búsqueda y filtros (H6, H7, H8)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/v1/properties` | Busca y filtra bienes disponibles por texto, ubicación, categoría, precio, depósito y fechas. | `TENANT` |

Los filtros pueden combinarse. El listado usa paginación de 12 resultados por página; los filtros
de fecha `startDate` y `endDate` deben enviarse juntos.

### Módulo 3: Reservas y calendario de disponibilidad (H9, H10, H12)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/v1/properties/:id/availability` | Consulta las fechas ocupadas del bien dentro del horizonte disponible. | `TENANT`; `OWNER` dueño |
| POST | `/api/v1/properties/:id/blocks` | Bloquea un rango de fechas del bien propio. | `OWNER` dueño |
| GET | `/api/v1/properties/:id/blocks` | Consulta bloqueos vigentes del bien propio. | `OWNER` dueño |
| DELETE | `/api/v1/blocks/:id` | Elimina un bloqueo propio. | `OWNER` dueño |
| POST | `/api/v1/bookings` | Crea una reserva pendiente para un bien y periodo disponible. | `TENANT` con perfil verificado |
| GET | `/api/v1/bookings/mine` | Lista las reservas del arrendatario autenticado. | `TENANT` |
| GET | `/api/v1/owner/bookings` | Lista reservas de los bienes del arrendador. | `OWNER` |

### Módulo 4: Pagos y depósitos de garantía (H13, H14)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/v1/payments/:bookingId/summary` | Consulta el desglose del pago de una reserva propia. | `TENANT` dueño de la reserva con perfil verificado |
| POST | `/api/v1/payments` | Procesa el pago simulado de una reserva. | `TENANT` dueño de la reserva con perfil verificado |
| GET | `/api/v1/bookings/:bookingId/transactions` | Consulta movimientos de una reserva relacionada. | `TENANT` de la reserva o `OWNER` del bien |
| POST | `/api/v1/bookings/:id/deposit/decision` | Registra devolución o retención del depósito. | `OWNER` dueño del bien |

### Módulo 5: Mensajería entre arrendador y arrendatario (H15, H16)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/v1/conversations` | Inicia o recupera la conversación con el propietario de un bien. | `TENANT` |
| GET | `/api/v1/conversations` | Lista las conversaciones propias. | `TENANT`, `OWNER` |
| GET | `/api/v1/conversations/:id/messages` | Consulta mensajes de una conversación y marca como leídos los recibidos. | Participantes del hilo |
| POST | `/api/v1/conversations/:id/messages` | Envía un mensaje al otro participante. | Participantes del hilo |

### Módulo 6: Reseñas y calificaciones (H17, H18)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/v1/reservations/:id/reviews/property` | Califica el bien y al arrendador de una reserva completada. | `TENANT` dueño de la reserva |
| POST | `/api/v1/reservations/:id/reviews/renter` | Califica al arrendatario de una reserva completada. | `OWNER` dueño del bien |
| GET | `/api/v1/tenants/:id/reviews` | Consulta calificaciones recibidas por un arrendatario. | `OWNER` |

### Módulo 7: Verificación de identidad/documentos (H19, H21)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/v1/profile/document` | Envía un documento de identidad para revisión. | `TENANT` |
| GET | `/api/v1/profile/document` | Consulta el estado de verificación propio. | `TENANT`, `OWNER` |
| GET | `/api/v1/profile/document/admin` | Lista documentos pendientes de revisión. | `ADMIN` |
| GET | `/api/v1/profile/document/admin/:userId` | Consulta el documento pendiente de un usuario. | `ADMIN` |
| PATCH | `/api/v1/profile/document/admin/:userId/approve` | Aprueba el documento de identidad. | `ADMIN` |
| PATCH | `/api/v1/profile/document/admin/:userId/reject` | Rechaza el documento con un motivo. | `ADMIN` |

### Módulo 8: Notificaciones (H22, H23)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/v1/notifications` | Lista notificaciones propias, de la más reciente a la más antigua. | Sesión (`TENANT`, `OWNER`) |
| GET | `/api/v1/notifications/unread-count` | Consulta la cantidad de notificaciones no leídas propias. | `TENANT`, `OWNER` |
| PATCH | `/api/v1/notifications/:id/read` | Marca una notificación propia como leída. | `TENANT`, `OWNER` |
| PATCH | `/api/v1/notifications/read-all` | Marca todas las notificaciones propias como leídas. | `TENANT`, `OWNER` |

El envío de notificaciones entre módulos se realiza mediante `NotificationsService`; no se expone
como endpoint para clientes.

### Módulo 9: Panel de reportes para el arrendador (H24, H25, H26, H27)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/v1/income/reports` | Consulta ingresos acumulados por alquiler y depósitos retenidos, con filtros de fecha opcionales. | `OWNER` |
| GET | `/api/v1/income/reports/by-property` | Consulta y pagina ingresos agrupados por bien. | `OWNER` |
| GET | `/api/v1/owner/reports/ratings` | Consulta calificaciones agregadas por bien. | `OWNER` |
| GET | `/api/v1/owner/reports/occupancy` | Consulta días ocupados y tasa de ocupación por bien. | `OWNER` |

### Ruta general

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/v1/` | Comprueba que la API responde. | Público |

## Formato general y errores

- `400`: datos inválidos (`VALIDATION_ERROR`).
- `401`: falta una sesión o credencial válida.
- `403`: la sesión no tiene el rol o permiso necesario.
- `404`: el recurso no existe o no pertenece a la cuenta cuando la API restringe por propietario.
- `409`: conflicto con el estado actual, por ejemplo, traslape, duplicado o acción no permitida.
- `429`: límite de intentos de inicio de sesión alcanzado.

Las rutas de carga de imágenes de bienes y documentos reciben `multipart/form-data`; las demás usan
JSON salvo que Swagger indique lo contrario. Los parámetros detallados, esquemas de respuestas y
validaciones están disponibles en Swagger.
