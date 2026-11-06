@AGENTS.md

# Runaways: Proyecto 4, Plataforma de renta/alquiler de equipo o espacios (BACKEND)

Proyecto académico de Ingeniería de Software (UCA, ciclo 02/2026, Sección 01). **Equipo Runaways.**
Este repo es el **backend**, un fork de `be_boilerplate_is_2026`. El frontend vive en otro repo.

La fuente de verdad funcional es el documento de historias de usuario del equipo. Respeta sus
rutas, roles, estados, mensajes y criterios tal como están redactados. Si algo del código choca
con el documento, pregunta antes de cambiarlo.

## Reglas (no negociables)
- No crear repos nuevos. Se trabaja sobre el fork del equipo, con ramas `feature/<ID>-<descripcion>`
  hacia `develop`, Pull Requests aprobados por otro integrante y commits con el ID de la historia.
- No romper el contrato de autenticación: la forma en que el sistema identifica al usuario, su rol
  y su sesión. Cualquier cambio de arquitectura se justifica en el único documento
  `docs/architecture.md`; agrega ahí las decisiones nuevas en vez de crear documentos separados.
- La autenticación y los roles se fusionan a `develop` antes que el resto de módulos.

## Stack
- NestJS sobre PostgreSQL, con Prisma como ORM. Swagger en `/api/docs`. Prefijo global `/api/v1`.
- Se levanta con el docker-compose obligatorio (`docker compose up -d`).
- Autenticación del boilerplate: JWT de acceso de 15 minutos, token de renovación rotado de 7 días,
  contraseñas con bcrypt y guard JWT global. Las rutas públicas se marcan con `@Public()`.

## Decisiones (documentar en `docs/architecture.md`)
- **Entrega de la sesión:** el backend responde el JWT y el frontend lo guarda en la cookie `session`
  (`HttpOnly`). El backend no pone cookies propias; Next.js las escribe desde una ruta de servidor.
- **Rol en el token:** el payload incluye `sub`, `email` y `role`. Los endpoints se protegen con
  `@Roles()` y `RolesGuard`. La identidad siempre sale de la sesión, nunca del cuerpo de la petición.
- **Renovación de sesión:** el access token dura 15 minutos y el refresh token hasta 7 días. Next.js
  renueva con el refresh token antes de que venza el access token y guarda el par rotado en `session`.
- **Cambio de rol:** tras cambiar de rol, la respuesta incluye un token nuevo con el rol actualizado.
- **Acceso sin sesión:** 401. **Sesión sin permiso:** 403.

## Roles
- `TENANT`: rol por defecto de toda cuenta nueva. Explora el catálogo, reserva y paga.
- `OWNER`: publica, edita, pausa y elimina sus bienes, bloquea fechas y decide sobre depósitos.
  No reserva ni paga mientras tenga ese rol.
- `ADMIN`: revisa documentos de identidad. No se asigna por registro ni por cambio de rol; solo lo crea
  el script de datos iniciales.
- Un usuario tiene un solo rol activo. Puede cambiar entre TENANT y OWNER, salvo que tenga
  reservas PENDIENTE o PAGADA, o depósitos pendientes de decisión.

## Endpoints

### Autenticación y cuentas
| Método y ruta | Rol | Notas |
|---|---|---|
| `POST /api/v1/auth/register` | Público | Recibe `name`, `email`, `password`; crea `User` y `Profile` en una transacción. Asigna `TENANT` e ignora `role` del cuerpo |
| `POST /api/v1/auth/login` | Público | Mensaje genérico «Correo o contraseña incorrectos»; 5 fallos por correo normalizado dentro de 15 minutos bloquean ese correo por 15 minutos, también si la cuenta no existe |
| `POST /api/v1/auth/refresh` | Refresh token | Rota el refresh token y entrega un access token nuevo |
| `POST /api/v1/auth/logout` | Sesión | |
| `GET /api/v1/auth/me` | Sesión | Datos del usuario de la sesión actual |
| `PATCH /api/v1/profile/role` | TENANT o OWNER | Cambio de rol. Responde con token nuevo |
| `POST /api/v1/profile/document` | Sesión | Sube el documento de identidad |

### Verificación (ADMIN)
| Método y ruta | Rol |
|---|---|
| `GET /api/v1/admin/verifications` | ADMIN |
| `PATCH /api/v1/admin/verifications/:userId/approve` | ADMIN |
| `PATCH /api/v1/admin/verifications/:userId/reject` | ADMIN |

### Bienes (catálogo y gestión)
| Método y ruta | Rol | Notas |
|---|---|---|
| `POST /api/v1/properties` | OWNER | Publica un bien |
| `GET /api/v1/properties` | TENANT, OWNER | Catálogo paginado. Acepta `page`, `q`, `category`, `location`, `minPrice`, `maxPrice`, `startDate`, `endDate`. Solo bienes DISPONIBLE |
| `GET /api/v1/properties/:id` | TENANT, OWNER | Detalle. Bienes PAUSADO, ELIMINADO o inexistentes responden 404 |
| `GET /api/v1/properties/:id/availability` | TENANT, OWNER | Calendario de 90 días |
| `GET /api/v1/properties/mine` | OWNER | Bienes propios, paginados |
| `GET /api/v1/properties/:id/owner` | OWNER dueño | Bien propio para edición |
| `PUT /api/v1/properties/:id` | OWNER dueño | Reemplazo completo. 409 si cambia precio o depósito con reservas PENDIENTE o PAGADA |
| `PATCH /api/v1/properties/:id/status` | OWNER dueño | Cambia entre DISPONIBLE y PAUSADO. 409 si hay reservas PENDIENTE o PAGADA |
| `DELETE /api/v1/properties/:id` | OWNER dueño | Borrado lógico (ELIMINADO). 409 si hay reservas PENDIENTE o PAGADA |

### Bloqueos de fechas
| Método y ruta | Rol |
|---|---|
| `POST /api/v1/properties/:id/blocks` | OWNER dueño |
| `GET /api/v1/properties/:id/blocks` | OWNER dueño |
| `DELETE /api/v1/blocks/:id` | OWNER dueño |

### Reservas y pagos
| Método y ruta | Rol | Notas |
|---|---|---|
| `POST /api/v1/bookings` | TENANT | Crea la reserva en PENDIENTE. Valida verificación (`verifiedOnly`) y traslapes en una operación atómica |
| `GET /api/v1/bookings/mine` | TENANT | Reservas propias |
| `GET /api/v1/owner/bookings` | OWNER | Reservas de sus bienes |
| `POST /api/v1/payments` | TENANT | Pago simulado. Valida verificación |
| `POST /api/v1/bookings/:id/deposit/decision` | OWNER dueño | Devolver o retener depósito |

### Reseñas
| Método y ruta | Rol |
|---|---|
| `POST /api/v1/reservations/:id/reviews/property` | TENANT |
| `POST /api/v1/reservations/:id/reviews/renter` | OWNER |

### Mensajería
| Método y ruta | Rol |
|---|---|
| `GET /api/v1/conversations` | TENANT, OWNER |
| `GET /api/v1/conversations/:id/messages` | Participantes del hilo |
| `POST /api/v1/conversations/:id/messages` | Participantes del hilo |

### Notificaciones
| Método y ruta | Rol | Notas |
|---|---|---|
| `POST /api/v1/notifications/internal` | Servicio interno | Solo lo llaman otros módulos del backend. No se expone al cliente |
| `GET /api/v1/notifications` | Sesión | Paginada, del más reciente al más antiguo |
| `GET /api/v1/notifications/unread-count` | Sesión | |
| `PATCH /api/v1/notifications/:id/read` | Sesión | |
| `PATCH /api/v1/notifications/read-all` | Sesión | |

### Reportes del arrendador
| Método y ruta | Rol |
|---|---|
| `GET /api/v1/owner/reports/income` | OWNER |
| `GET /api/v1/owner/reports/income/by-property` | OWNER |
| `GET /api/v1/owner/reports/ratings` | OWNER |
| `GET /api/v1/owner/reports/occupancy` | OWNER |

## Modelo de datos (resumen)
- `User`: id, name, email (único), passwordHash, role, isActive, createdAt, updatedAt.
- `Profile`: id, userId (único, 1 a 1 con User), isVerified. No incluye apellido ni teléfono.
  El registro crea el perfil junto al usuario.
- `Property`: id, ownerId, title, description, category (PROPIEDAD o EQUIPO), department, municipality,
  address, pricePerDay, securityDeposit, images (string[] de Firebase), status (DISPONIBLE, PAUSADO,
  ELIMINADO), createdAt, updatedAt.
- `NoAvailability`, `Booking`, `Payment`, `Deposit`, `TransactionHistory`, `Review`, `Conversation`,
  `Message`, `IdentityDocument` y `Notification`: ver el diagrama del equipo.

## Estados (nombres fijos; transiciones fuera de la tabla responden 409)
- Bien: DISPONIBLE, PAUSADO, ELIMINADO. ELIMINADO es final.
- Reserva: PENDIENTE, PAGADA, FINALIZADA, CANCELADA. PENDIENTE expira a las 24 horas sin pago.
- Depósito: PENDIENTE, DEVUELTO, RETENIDO, RETENIDO_PARCIAL.
- Documento de identidad: PENDIENTE, APROBADO, RECHAZADO.
- Cuenta (calculada): SIN_VERIFICAR, PENDIENTE, VERIFICADA, RECHAZADA.
- Notificación: UNREAD, READ.

## Reglas de negocio
- **Fechas:** se guardan en horario de El Salvador. Entrega y devolución sí guardan fecha y hora.
- **Periodo:** mínimo 1 día, máximo 30. Los días incluyen inicio y fin.
- **Horizonte:** solo se consultan y reservan fechas dentro de 90 días.
- **Traslapes:** dos periodos chocan si el inicio de uno es menor o igual que el fin del otro y viceversa.
  Validación y creación de la reserva en una sola operación atómica. Dos solicitudes simultáneas: una
  gana, la otra recibe 409.
- **Precio:** el servidor usa el precio guardado en el bien y calcula el subtotal. No confía en el precio
  ni en el subtotal que envía el cliente.
- **Montos:** USD con dos decimales, enviados como texto decimal (por ejemplo `"45.00"`).
- **Pago simulado:** sin pasarela real. Nunca se guardan el número completo de la tarjeta ni el CVC;
  solo los últimos 4 dígitos.
- **Notificaciones:** los módulos usan el servicio interno de notificaciones. El destinatario sale de
  la base de datos, nunca del cliente.
- **Mensajes:** solo el arrendador propietario y el arrendatario involucrados pueden ver un hilo.

## Formato de respuestas y errores
- Códigos: 400 datos inválidos, 401 sin sesión, 403 rol sin permiso, 404 no existe o no pertenece al
  usuario, 409 conflicto (duplicado, traslape, estado no permitido, cambio bloqueado).
- Login: después de 5 fallos para el mismo correo normalizado dentro de 15 minutos se bloquean nuevos
  intentos durante 15 minutos y se responde 429. El control también cuenta correos inexistentes,
  devuelve el mismo 401 genérico para correo desconocido y contraseña incorrecta, y reinicia el
  contador al iniciar sesión bien.
- Errores con `code` y `message`. Ejemplos: `VALIDATION_ERROR`, `FORBIDDEN`, `ROLE_CHANGE_BLOCKED`,
  `ROLE_UNCHANGED`.
- Listados paginados: respuesta con `data`, `total`, `page` y `pageSize`. Catálogo y "Mis publicaciones"
  usan 12 y 10 por página; los demás usan 10 salvo que se indique otro valor.

## Convenciones de código
- Código e identificadores en inglés. Mensajes de error visibles en español.
- Los valores de enum se respetan tal cual (`DISPONIBLE`, `OWNER`…).
- Ramas: `feature/<ID>-<descripcion>`. Commits: empiezan con el ID de la historia (`H28: agregar enum Role`).
- Migraciones con `npx prisma migrate dev`. No editar a mano migraciones ya fusionadas.
- Antes de un PR: `npm run lint`, `npm run build` y `npm test` deben pasar.
- Cada cambio de código pertenece a una historia del tablero. Si no corresponde a ninguna, se crea una
  card nueva con el siguiente número disponible.

## Comandos
- `docker compose up -d`: base de datos y backend en local.
- `npx prisma migrate dev`: aplica migraciones en desarrollo.
- `npx prisma db seed`: carga las cuentas y bienes de prueba (idempotente).
- `npm run dev`, `npm test`, `npm run lint`, `npm run build`.
