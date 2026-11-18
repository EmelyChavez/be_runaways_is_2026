# Decisiones técnicas

Este documento registra patrones del proyecto y el motivo de usarlos. Las rutas y reglas completas
están en [endpoints.md](./endpoints.md) y [flujos-autenticacion.md](./flujos-autenticacion.md).

## Servicios y repositorios

Los servicios contienen reglas de negocio y coordinan casos de uso. Los repositorios aíslan Prisma
y concentran consultas, escrituras y transacciones. Los controladores se limitan al contrato HTTP.
Esto permite mantener reglas fuera de los controladores y probar los servicios sin acoplarlos al
formato de consultas de Prisma.

## Bloqueos de disponibilidad

El controlador limita el acceso a `OWNER` y utiliza DTOs para el cuerpo y la respuesta. La validación
del rango (fecha local de El Salvador, orden y horizonte de 90 días), autorización de propiedad y
decisión de conflicto viven en `PropertiesService`; `PropertiesRepository` solo encapsula las
consultas y persistencia Prisma. La creación usa una transacción serializable para evitar que
solicitudes concurrentes creen bloqueos incompatibles con otros bloqueos o reservas `PENDING`/`PAID`.
Los días son inclusivos, igual que en las reservas.

## Envío interno de notificaciones

`NotificationsService.emit` es la fachada única para que otros módulos soliciten avisos. Las
plantillas centralizan el formato de los eventos conocidos; el repositorio valida la existencia del
destinatario antes de crear la fila. La función se exporta desde `NotificationsModule` sin controlador
HTTP, porque esta historia define el envío entre módulos y no establece credenciales para exponer un
endpoint interno a clientes. Los enums `OriginModule` usan valores en inglés: `RESERVATIONS`,
`PAYMENTS`, `MESSAGING` y `VERIFICATION`.

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

## Documentos de identidad en Cloudinary

`IdentityDocumentCloudinaryService` gestiona los documentos de identidad de forma independiente a las imágenes de propiedades. Almacena archivos JPG, PNG y PDF en Cloudinary, como recursos privados de tipo `raw`, con un límite de 5 MB. Cada archivo utiliza un `public_id` aleatorio que no contiene información del usuario. El campo `identity_document.document_url` guarda la URL HTTPS del recurso autenticado, pero el GET de estado no la devuelve.

El servicio valida el número de documento según el tipo seleccionado (`DUI` o `PASSPORT`), el formato, el MIME, la firma y el tamaño del archivo. También comprueba que el usuario no esté verificado ni tenga otro documento en estado `PENDING`.

**Reemplazo de documentos rechazados**

Cuando un usuario sube un nuevo documento después de que el anterior fue rechazado, se utiliza `updateMany` para actualizar el registro únicamente si el documento sigue sin estar `PENDING` y el perfil no está verificado. Esto evita reemplazar documentos cuando otra solicitud ya modificó su estado. Si no se cumplen las condiciones, responde `409 Conflict` y elimina el archivo nuevo de Cloudinary.

**Eliminación y manejo de archivos**

El documento anterior se elimina de Cloudinary únicamente después de confirmar que el nuevo se guardó correctamente en la base de datos. Si la actualización falla, se elimina el archivo nuevo para evitar dejar archivos sin registros asociados.

Finalmente, la consulta del estado de verificación solo devuelve el estado y los metadatos de revisión, sin exponer el número de identidad ni una URL del archivo. La lectura del documento queda reservada para una ruta autorizada de revisión.

## Prisma y PostgreSQL

El proyecto usa Prisma como ORM y PostgreSQL como base. `PrismaService` configura el driver adapter
de PostgreSQL en tiempo de ejecución, acorde con Prisma 7. Los repositorios inyectan ese servicio;
los controladores no acceden directamente a la base.

## Integración de verificación con notificaciones

Al confirmar la aprobación o el rechazo de un documento, `IdentityDocumentService` invoca `NotificationsService.emit` para el usuario propietario del documento. El evento `DOCUMENT_REJECTED` recibe el motivo para completar su plantilla; `DOCUMENT_APPROVED` usa su plantilla fija. La llamada ocurre después de persistir el cambio de estado.

## Mensajería entre arrendatarios y propietarios

`MessagingService` aplica la participación del usuario, determina al destinatario desde el hilo y
rechaza el auto-envío. `MessagingRepository` contiene solo operaciones de Prisma: asegura un hilo
único por bien y arrendatario, consulta mensajes cronológicamente, actualiza el indicador de lectura
de mensajes entrantes y persiste cada mensaje junto con la actividad reciente del hilo en una
transacción. Al persistir el mensaje, el servicio solicita a `NotificationsService.emit` el evento
`MESSAGE_NEW` para el otro participante. No se acepta el destinatario desde el cuerpo de la petición.

`POST /conversations` es el punto de entrada que permite al arrendatario iniciar el hilo desde el
detalle del bien; es idempotente y devuelve el hilo existente si ya lo había iniciado. Solo TENANT
puede iniciar conversaciones, mientras TENANT y OWNER pueden leer y responder dentro de hilos donde
participan.

## Creación y vencimiento de reservas

`BookingsService` valida fechas de calendario en horario de El Salvador, cuenta los días incluyendo
inicio y fin, calcula el subtotal desde el precio guardado y establece `expiresAt` a 24 horas. La
comprobación de traslapes con reservas `PAID`, `PENDING` no vencidas y bloqueos, junto con la creación
`PENDING`, ocurre en una transacción serializable. Un conflicto de serialización se traduce al mismo
`409 DATES_UNAVAILABLE` que una fecha ocupada, de modo que dos solicitudes concurrentes no confirman
el mismo periodo.

Un proceso periódico del módulo cambia reservas pendientes vencidas a `CANCELED` con una actualización
condicional sobre el estado y vencimiento; solo el proceso que cambia la fila emite notificaciones de
cancelación para arrendatario y arrendador. Los eventos usan `RESERVATION_CREATED` y
`RESERVATION_CANCELED_EXPIRED` con el origen enum `RESERVATIONS`.

## Pagos simulados y movimientos

`PaymentsService` calcula los importes con el subtotal almacenado en `Booking` y el depósito guardado
en `Property`; el cliente solo envía el UUID de la reserva y los últimos cuatro dígitos. La tarjeta
`0002` representa fondos insuficientes; la simulación aprobada devuelve el recibo único de `Payment`.
El servicio registra `Payment`, cambia `Booking` a `PAID`, crea `Deposit` y `TransactionHistory` en
una transacción serializable para evitar doble cobro. Solo persiste los últimos cuatro dígitos, nunca
el número completo, vencimiento ni CVC. El modelo `Payment` creado por H24 conserva importes de
alquiler y depósito para reportes futuros por arrendador, pero H13 no transfiere dinero a cuentas
externas.

La consulta de movimientos exige que la sesión corresponda al arrendatario de la reserva o al
arrendador de su bien. `Property.verifiedOnly` determina si se requiere `Profile.isVerified` al
reservar y pagar. El historial guarda el tipo enum `CHARGE` y la API lo presenta como `COBRO`, según
el vocabulario de la historia.

## Decisión de devolución o retención del depósito

`DepositDecisionsService` aplica las decisiones y `DepositsRepository` encapsula las
consultas y escrituras. La decisión se limita al OWNER propietario, a reservas `COMPLETED` y a
depósitos positivos en estado `PENDING`. Una transacción serializable actualiza condicionalmente el
depósito y registra los movimientos `REFUND` y/o `RETENTION`; en retenciones parciales, el valor
retenido más el devuelto siempre coincide con el depósito original. El servicio notifica al tenant
después de confirmar la transacción.

La entidad `Booking` no tiene `returnedAt` o `completedAt`; para contar los siete días calendario,
H14 usa `Booking.updatedAt` como instante en que la reserva pasó a `COMPLETED`. Un proceso periódico
busca depósitos todavía `PENDING` cuyas reservas completadas superaron ese plazo y registra la
devolución con motivo «Plazo de decisión vencido». La actualización condicional y serializable evita
que una decisión manual concurrente provoque una devolución doble. Esta equivalencia debe mantenerse
si una historia futura incorpora un evento o campo específico para registrar la devolución física.
