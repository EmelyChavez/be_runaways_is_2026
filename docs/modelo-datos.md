# Modelo de datos

La fuente del esquema es [`prisma/schema.prisma`](../prisma/schema.prisma). Este documento resume
los modelos que existen actualmente en ese esquema; los modelos mencionados en historias pero aún
no añadidos a Prisma se consideran pendientes.

## Diagrama

Diagrama conceptual de la base de datos del equipo:

![Diagrama de la base de datos del proyecto](./images/DiagramaSoftware.jpg)

## Entidades actuales

| Entidad | Descripción y campos principales |
|---|---|
| `User` | Cuenta con `id` UUID, `role`, `name`, email único, `passwordHash`, `isActive`, `createdAt` y `updatedAt`. |
| `Profile` | Perfil con `id`, `userId` único y `isVerified`. El registro crea el perfil junto a la cuenta. |
| `IdentityDocument` | Tabla `identity_document`, relacionada 1:1 con `Profile`: `documentType`, `documentNumber`, `documentUrl`, `documentStatus`, `submittedAt`, `rejectionReason` y `reviewedAt`. `documentUrl` guarda la URL HTTPS del recurso autenticado de Cloudinary; no se incluye en la respuesta de estado. |
| `RefreshToken` | Sesión renovable. Guarda `tokenHash` único, `userId`, `expiresAt`, `revokedAt` y `createdAt`; nunca almacena el refresh token en claro. |
| `LoginAttempt` | Contador por identificador HMAC (`keyHash`), con `attempts`, inicio de ventana, vencimiento y `lockedUntil`. No guarda el correo en claro. |
| `Property` | Bien de un `owner` con título (máximo 100 caracteres), descripción, categoría, ubicación, precio, depósito, arreglo `images` y estado. `images` es `String[]` con URLs seguras de Cloudinary. |
| `Booking` | Reserva una propiedad por un `tenant`, con fechas, subtotal, estado y fecha de expiración. |
| `Deposit` | Depósito asociado 1 a 1 con una reserva; puede tener un `decidedBy` opcional y guarda monto, estado, montos devuelto/retenido y fechas de decisión. |
| `Review` | Reseña asociada a una reserva (`reservationId` referencia `Booking.id`), un bien, autor y usuario objetivo. `RENTER_TO_PROPERTY` requiere `propertyRating`; `OWNER_TO_RENTER` no la usa. `userRating` siempre es obligatorio. Ambas puntuaciones van de 1 a 5 y `comment` admite hasta 200 caracteres. |
| `Notification` | Aviso dirigido a un usuario con evento, módulo de origen, título (máximo 100), mensaje (máximo 250), referencia UUID opcional, estado `UNREAD`/`READ` y marcas de tiempo. |

## Bloqueos de disponibilidad

`NoAvailability` registra los periodos que el arrendador bloquea para una propiedad. El catálogo y el calendario los consideran junto con las reservas `PAID` y `PENDING`; la respuesta de disponibilidad solo expone los días ocupados, nunca la identidad del arrendatario.

## Enums actuales

- `Role`: `TENANT`, `OWNER`, `ADMIN`.
- `PropertyCategory`: `PROPERTY`, `EQUIPMENT`.
- `PropertyStatus`: `AVAILABLE`, `PAUSED`, `DELETED`.
- `BookingStatus`: `PENDING`, `PAID`, `COMPLETED`, `CANCELED`.
- `DepositStatus`: `PENDING`, `RETURNED`, `RETAINED`, `PARTIALLY_RETAINED`.
- `ReviewType`: `RENTER_TO_PROPERTY`, `OWNER_TO_RENTER`.
- `IdentityDocumentType`: `DUI`, `PASSPORT`.
- `IdentityDocumentStatus`: `PENDING`, `APPROVED`, `REJECTED`.
- `AccountStatus`: `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED` (estado calculado que devuelve la consulta del perfil).
- `NotificationStatus`: `UNREAD`, `READ`.
- `OriginModule`: `RESERVATIONS`, `PAYMENTS`, `MESSAGING`, `VERIFICATION`.
- `NotificationEventType`: `RESERVATION_CREATED`, `PAYMENT_CONFIRMED`, `RESERVATION_CANCELED_EXPIRED`, `RESERVATION_FINISHED`, `MESSAGE_NEW`, `DEPOSIT_RETURNED`, `DEPOSIT_RETURNED_AUTO`, `DEPOSIT_RETAINED`, `DOCUMENT_APPROVED`, `DOCUMENT_REJECTED`.
