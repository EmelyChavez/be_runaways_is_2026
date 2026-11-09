# Flujos de autenticación

Este documento describe lo que hace el backend actual y la responsabilidad acordada para el
frontend Next.js.

## Registro

`POST /api/v1/auth/register` recibe `name`, `email` y `password`. El email se recorta y normaliza a
minúsculas. La contraseña debe tener entre 8 y 72 caracteres e incluir mayúscula, minúscula y
número. El `ValidationPipe` rechaza campos adicionales, incluido `role`. El backend asigna
`TENANT`, genera el hash bcrypt y crea también el `Profile` con `isVerified: false`. La respuesta
contiene `id`, `email`, `role` y `name`, nunca la contraseña ni su hash.

## Login

`POST /api/v1/auth/login` recibe `email` y `password` y responde `200` cuando las credenciales son
válidas. El cuerpo incluye `accessToken`, `refreshToken`, `expiresIn` y `user`.

- Correo inexistente y contraseña incorrecta producen el mismo `401` genérico.
- Para un correo inexistente se ejecuta una comparación bcrypt con un hash descartable. No se guarda
  ese hash en la base ni se crea una cuenta; solo evita responder inmediatamente sin trabajo bcrypt.
- El limitador cuenta intentos usando un HMAC del email normalizado, no el email en claro. Cinco
  fallos en 15 minutos activan un bloqueo temporal de 15 minutos y se responde `429`, también para
  emails inexistentes. Un login exitoso limpia el contador.
- Una cuenta deshabilitada responde `403` solo después de que la contraseña sea correcta.

## Uso y renovación de tokens

El access token es JWT HS256 con `sub`, `email` y `role`; su duración por defecto es 15 minutos.
Las solicitudes protegidas envían `Authorization: Bearer <accessToken>`. El guard verifica el JWT y
vuelve a cargar el usuario para comprobar que existe y continúa activo.

El refresh token es aleatorio y opaco, con duración por defecto de 7 días. La base conserva su hash
SHA-256. `POST /api/v1/auth/refresh` recibe `{ "refreshToken": "..." }`, revoca el token usado y
devuelve un par nuevo. Reutilizar un token ya rotado revoca todas las sesiones del usuario y
responde `401`.

## Cierre de sesión

`POST /api/v1/auth/logout` recibe el refresh token en el cuerpo, lo revoca y responde `204` sin
cuerpo. El access token puede seguir siendo aceptado hasta su expiración; el logout revoca la
capacidad de renovar la sesión.

## Cookie del frontend

El backend no establece cookies. Devuelve los tokens en JSON. El servidor de Next.js debe llamar al
backend y guardar el par en una cookie `session` con `HttpOnly`, `Secure` en producción,
`SameSite=Lax`, `Path=/` y vencimiento no superior a la vida del refresh token. Next.js debe renovar
antes de que venza el access token, guardar el par rotado y borrar la cookie al cerrar sesión.
Los componentes cliente no deben recibir los tokens.

## Identidad y roles

Las rutas están protegidas por defecto. `@Public()` excluye rutas como registro y login del guard
JWT; refresh y logout también llevan ese decorador, pero requieren el refresh token en el cuerpo.
`@Roles(...)` declara los roles permitidos y `RolesGuard` comprueba el rol del usuario autenticado.
Sin sesión válida se responde `401`; con sesión pero sin permiso, `403`.

El cambio de rol en `PATCH /api/v1/profile/role` devuelve un par nuevo de tokens para que Next.js
actualice la cookie con el rol vigente.
