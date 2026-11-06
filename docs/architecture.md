# Runaways: decisiones de arquitectura

## Autenticación y contrato de sesión

## Decisión

El backend emite los tokens y los devuelve en el cuerpo JSON. No crea ni modifica
cookies. El frontend Next.js es responsable de guardar la sesión en una cookie
HTTP-only llamada `session`. Esta separación conserva el contrato actual de la
API y evita exponer los tokens a JavaScript que corre en el navegador.

## Contrato del backend

`POST /api/v1/auth/login` recibe `{ "email": "...", "password": "..." }` y
responde `200` con `accessToken`, `refreshToken`, `expiresIn` y `user`. El backend
no devuelve un encabezado `Set-Cookie`.

Los fallos de login se cuentan usando un HMAC del correo normalizado, sin
guardar el correo en claro en la tabla de límites. Cinco fallos dentro de 15
minutos bloquean temporalmente ese identificador por otros 15 minutos; aplica
igual si el correo no existe. Los primeros fallos responden con el mismo `401`
genérico para correo inexistente y contraseña errónea; al alcanzar el límite se
responde `429`. Un login exitoso limpia el contador de ese correo.

### Cómo se cuentan los intentos

Para saber a qué correo pertenecen los intentos, el backend calcula un código
con el correo normalizado y una clave secreta del servidor. Guarda ese código
en `login_attempts.key_hash`, junto al contador y los tiempos del bloqueo; no
guarda el correo en esa tabla. Cuando llega otro intento, calcula el código de
nuevo y lo usa para encontrar el contador correcto. Es como una etiqueta secreta
para agrupar intentos. **No es un token de sesión ni permite iniciar sesión.**

### Por qué se usa un hash descartable

Si el correo sí existe pero la contraseña está mal, el backend compara la
contraseña con el hash guardado para esa cuenta. Si el correo no existe, compara
la contraseña con un **hash descartable de contraseña** que no pertenece a
ninguna cuenta. Esa comparación no crea una cuenta ni inicia sesión; solo hace
que el servidor realice un trabajo parecido antes de responder.

Así se reducen las pistas que podría dar el tiempo de respuesta para descubrir
qué correos tienen cuenta. No garantiza que todas las respuestas tarden
exactamente lo mismo. En ambos casos, el mensaje es `Correo o contraseña
incorrectos`. Este hash descartable es distinto del código HMAC usado para
contar intentos y también es distinto de los tokens JWT de sesión.

El access token es un JWT HS256 de corta duración. Sus claims son `sub`, `email`
y `role`; el rol se toma del usuario guardado en la base, nunca del cuerpo de la
petición. `expiresIn` informa su duración en segundos (900 segundos por defecto).

El refresh token es opaco, aleatorio y de larga duración (7 días por defecto).
La base guarda únicamente su hash SHA-256. `POST /api/v1/auth/refresh` recibe el
refresh token en el cuerpo, revoca el token usado y devuelve un par nuevo. Si se
detecta el reuso de un token rotado, se revocan las sesiones del usuario.

`POST /api/v1/auth/logout` recibe el refresh token y lo revoca. Responde `204`
sin cuerpo; el frontend también debe borrar su cookie `session`.

## Responsabilidad del frontend Next.js

El navegador debe llamar a una ruta de servidor de Next.js para login, refresh y
logout. Esa ruta de servidor llama al backend y guarda la sesión en la cookie
`session`. La cookie debe llevar `HttpOnly`, `Secure` en producción, `SameSite=Lax`,
`Path=/` y una duración que no exceda los 7 días del refresh token. Next.js debe
leerla solo en el servidor y no devolver los tokens a componentes cliente.

Para una solicitud protegida, el servidor de Next.js toma el access token de la
sesión y lo envía al backend como `Authorization: Bearer <accessToken>`. Antes de
que expire, renueva la sesión llamando a `/auth/refresh` con el refresh token,
reemplaza ambos tokens en la cookie y continúa la solicitud. Al cerrar sesión,
llama a `/auth/logout` y elimina la cookie incluso si el backend ya no acepta el
refresh token.

## Registro de decisiones

Este es el documento único del repositorio para decisiones y contratos de
arquitectura. Las decisiones nuevas se agregan aquí con su justificación; no se
crean archivos de documentación separados para cada módulo. El README enlaza a
este documento para que sea fácil de encontrar por el equipo, los revisores y la
cátedra.
