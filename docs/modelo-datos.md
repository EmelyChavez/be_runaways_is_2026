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
| `RefreshToken` | Sesión renovable. Guarda `tokenHash` único, `userId`, `expiresAt`, `revokedAt` y `createdAt`; nunca almacena el refresh token en claro. |
| `LoginAttempt` | Contador por identificador HMAC (`keyHash`), con `attempts`, inicio de ventana, vencimiento y `lockedUntil`. No guarda el correo en claro. |
| `Property` | Bien de un `owner` con título (máximo 100 caracteres), descripción, categoría, ubicación, precio, depósito, arreglo `images` y estado. `images` es `String[]` con URLs seguras de Cloudinary. |
| `Booking` | Reserva una propiedad por un `tenant`, con fechas, subtotal, estado y fecha de expiración. |
| `NoAvailability` | Rango inclusivo de fechas bloqueado por el propietario para una propiedad. |
| `Deposit` | Depósito asociado 1 a 1 con una reserva; puede tener un `decidedBy` opcional y guarda monto, estado, montos devuelto/retenido y fechas de decisión. |
| `Review` | Reseña asociada a una reserva (`reservationId` referencia `Booking.id`), un bien, autor y usuario objetivo. `RENTER_TO_PROPERTY` requiere `propertyRating`; `OWNER_TO_RENTER` no la usa. `userRating` siempre es obligatorio. Ambas puntuaciones van de 1 a 5 y `comment` admite hasta 200 caracteres. |

## Enums actuales

- `Role`: `TENANT`, `OWNER`, `ADMIN`.
- `PropertyCategory`: `PROPERTY`, `EQUIPMENT`.
- `PropertyStatus`: `AVAILABLE`, `PAUSED`, `DELETED`.
- `BookingStatus`: `PENDING`, `PAID`, `COMPLETED`, `CANCELED`.
- `DepositStatus`: `PENDING`, `RETURNED`, `RETAINED`, `PARTIALLY_RETAINED`.
- `ReviewType`: `RENTER_TO_PROPERTY`, `OWNER_TO_RENTER`.