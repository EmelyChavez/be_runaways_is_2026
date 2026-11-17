# Reporte consolidado de pruebas

## Resumen global

| Tipo | Ejecutadas | Aprobadas | Fallidas |
|---|---:|---:|---:|
| Unitarias | 229 | 229 | 0 |
| E2E | 0 | 0 | 0 |
| **Total** | **229** | **229** | **0** |


## Módulo 1: Catálogo de propiedades/equipo — H5: Pausar, reactivar o eliminar una publicación

### Casos positivos ejecutados

- **H5-U01:** El arrendador puede pausar una publicación disponible y el sistema confirma el nuevo estado.
- **H5-U02:** El arrendador puede reactivar una publicación pausada y el sistema vuelve a habilitarla.
- **H5-U03:** El arrendador puede eliminar lógicamente un bien propio y sus reseñas se conservan.
- **H5-U04:** Solo el rol OWNER puede gestionar el estado o eliminar una publicación.
- **H5-U05:** El sistema autoriza al arrendador autenticado a gestionar sus publicaciones.
- **H5-U06:** El catálogo y el detalle público ocultan bienes pausados o eliminados, y Mis publicaciones omite los eliminados.
- **H5-U19:** El sistema considera reservas PENDING y PAID al comprobar si una publicación puede cambiar de estado o eliminarse.

### Casos negativos ejecutados

- **H5-U07:** El sistema no permite usar DELETED como estado de destino.
- **H5-U08:** El sistema no permite cambiar el estado de un bien ajeno o inexistente.
- **H5-U09:** El sistema no permite eliminar un bien ajeno o inexistente.
- **H5-U10:** El sistema bloquea cambios y eliminación cuando el bien tiene una reserva PENDING.
- **H5-U11:** El sistema bloquea cambios y eliminación cuando el bien tiene una reserva PAID.
- **H5-U12:** El sistema no permite reactivar un bien que ya fue eliminado.
- **H5-U13:** El sistema no permite eliminar nuevamente un bien que ya está eliminado.
- **H5-U14:** Una solicitud sin sesión no puede gestionar publicaciones.
- **H5-U15:** Un usuario con rol TENANT no puede gestionar ni eliminar publicaciones.
- **H5-U16:** Un usuario con rol ADMIN no puede gestionar ni eliminar publicaciones.
- **H5-U17:** El sistema no autoriza la operación cuando falta el usuario autenticado.
- **H5-U18:** El sistema rechaza identificadores que no tengan formato UUID.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H5-U01 | Positiva | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Pausar publicación AVAILABLE | Llamar servicio con estado destino PAUSED y bien AVAILABLE; revisar actualización y respuesta. | Actualiza a PAUSED y devuelve id, status y statusChangedAt. | Repositorio consultado y actualizado en transacción; respuesta contiene los campos esperados. | Aprobado |
| H5-U02 | Positiva | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Reactivar publicación PAUSED | Llamar servicio con estado destino AVAILABLE; revisar respuesta. | Actualiza a AVAILABLE y devuelve la fecha de cambio. | Repositorio actualizado a AVAILABLE y respuesta contiene statusChangedAt. | Aprobado |
| H5-U03 | Positiva | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Eliminación lógica | Eliminar bien propio sin reservas activas; verificar softDelete transaccional. | Cambia a DELETED y conserva reseñas relacionadas. | Se invocó softDelete dentro de transacción; no se borran reseñas. | Aprobado |
| H5-U04 | Positiva | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Rol requerido OWNER | Leer metadata de cambio de estado y eliminación. | Ambos endpoints requieren OWNER. | Ambos declaran OWNER. | Aprobado |
| H5-U05 | Positiva | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Arrendador autorizado | Ejecutar RolesGuard con usuario OWNER. | El guard permite la operación. | RolesGuard devolvió true. | Aprobado |
| H5-U06 | Positiva | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Ocultar bienes no disponibles | Consultar filtros de catálogo, detalle y Mis publicaciones. | Catálogo y detalle exponen solo AVAILABLE; Mis publicaciones omite eliminados. | Catálogo filtra AVAILABLE, detalle devuelve 404 y se consulta Mis publicaciones. | Aprobado |
| H5-U07 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Estado destino no permitido | Validar DTO con estado DELETED como destino. | DTO rechaza el estado con error 400. | class-validator produjo errores para DELETED. | Aprobado |
| H5-U08 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Bien ajeno o inexistente al cambiar estado | Simular búsqueda de bien propio sin resultado e intentar cambio. | Responde 404 y no actualiza el bien. | NotFoundException; updateStatus no fue llamado. | Aprobado |
| H5-U09 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Bien ajeno o inexistente al eliminar | Simular búsqueda de bien propio sin resultado e intentar eliminar. | Responde 404 y no elimina el bien. | NotFoundException; softDelete no fue llamado. | Aprobado |
| H5-U10 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Reserva PENDING bloquea cambios | Simular reserva activa y probar cambio de estado y eliminación. | Ambas operaciones responden 409 con el mensaje acordado. | Ambas rechazadas con 409 y mensaje requerido; no se escribió. | Aprobado |
| H5-U11 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Reserva PAID bloquea cambios | Simular reserva activa y probar cambio de estado y eliminación. | Ambas operaciones responden 409 con el mensaje acordado. | Ambas rechazadas con 409 y mensaje requerido; no se escribió. | Aprobado |
| H5-U12 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | No cambiar estado DELETED | Simular bien DELETED e intentar reactivarlo. | Responde 409 y no actualiza. | ConflictException antes de consultar reservas o actualizar. | Aprobado |
| H5-U13 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | No eliminar un bien ya DELETED | Simular bien DELETED e intentar eliminarlo de nuevo. | Responde 409 y no vuelve a eliminar. | ConflictException; softDelete no fue llamado. | Aprobado |
| H5-U14 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Solicitud sin sesión | Ejecutar JwtAuthGuard sin Authorization. | Guard responde 401. | Rechazo con estado 401. | Aprobado |
| H5-U15 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Rol TENANT no autorizado | Ejecutar RolesGuard con usuario TENANT en endpoint de eliminación. | Guard responde 403. | Rechazo con estado 403. | Aprobado |
| H5-U16 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Rol ADMIN no autorizado | Ejecutar RolesGuard con usuario ADMIN en endpoint de eliminación. | Guard responde 403. | Rechazo con estado 403. | Aprobado |
| H5-U17 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Sin usuario autenticado | Ejecutar RolesGuard sin usuario en la solicitud. | Guard responde 401. | Rechazo con estado 401. | Aprobado |
| H5-U18 | Negativa | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | UUID inválido | Enviar ID inválido a ParseUUIDPipe de ambas rutas. | Ambas rutas responden 400. | Ambos pipes rechazaron con BadRequestException. | Aprobado |
| H5-U19 | Positiva | Módulo 1: Catálogo de propiedades/equipo / H5: Pausar, reactivar o eliminar una publicación | Estados de reservas que bloquean gestión | Consultar countActiveBookings y revisar el filtro enviado a Prisma. | El conteo considera reservas PENDING y PAID del bien. | La consulta incluye ambos estados en el filtro. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H5.spec.ts` — Vitest reportó 1 archivo aprobado y 19 pruebas aprobadas.


## Módulo 2: Búsqueda y filtros — H6: Búsqueda de bienes por criterios

### Casos positivos ejecutados

- **H6-U01:** El arrendatario puede buscar publicaciones disponibles por texto.
- **H6-U02:** El arrendatario puede combinar texto, ubicación, categoría y filtro de depósito en una búsqueda.
- **H6-U03:** El arrendatario puede limitar los resultados a bienes de categoría PROPERTY.
- **H6-U04:** El arrendatario puede limitar los resultados a bienes de categoría EQUIPMENT.
- **H6-U05:** El arrendatario puede filtrar por departamento sin indicar municipio.
- **H6-U06:** El sistema actualiza los resultados cuando el arrendatario cambia o quita filtros.
- **H6-U07:** Si ningún bien coincide, el sistema devuelve una lista vacía y total cero.
- **H6-U08:** Solo el rol TENANT tiene acceso al catálogo de búsqueda.
- **H6-U09:** El sistema autoriza al arrendatario autenticado a buscar en el catálogo.

### Casos negativos ejecutados

- **H6-U10:** El sistema no permite filtrar por municipio si no se indica el departamento.
- **H6-U11:** El sistema rechaza términos de búsqueda que no alcanzan la longitud mínima.
- **H6-U12:** El sistema rechaza términos de búsqueda que superan la longitud máxima.
- **H6-U13:** El sistema no acepta categorías distintas de PROPERTY o EQUIPMENT.
- **H6-U14:** El sistema no acepta para el filtro sin depósito valores distintos de true o false.
- **H6-U15:** Un usuario con rol OWNER no puede acceder al catálogo de búsqueda.
- **H6-U16:** Una solicitud sin token de sesión no puede acceder al catálogo.
- **H6-U17:** El sistema no autoriza la búsqueda si no hay un usuario autenticado.
- **H6-U18:** El sistema rechaza el acceso al catálogo para el rol OWNER.
- **H6-U19:** El sistema rechaza el acceso al catálogo para el rol ADMIN.
### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H6-U01 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Búsqueda por texto | Llamar el servicio con `q=casa`; revisar argumentos enviados al repositorio y respuesta. | El repositorio recibe el texto y estado AVAILABLE; se devuelven lista y total correspondientes. | Filtros y texto enviados; lista de 1 y total 1. | Aprobado |
| H6-U02 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Combinación de criterios | Enviar texto, departamento, municipio, categoría y `noDeposit=true`; revisar filtros enviados. | Todos los criterios se combinan con estado AVAILABLE. | Todos los filtros se enviaron en la consulta. | Aprobado |
| H6-U03 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Categoría PROPERTY | Consultar con `category=PROPERTY`; revisar filtro. | Se aplica la categoría PROPERTY. | Filtro PROPERTY enviado. | Aprobado |
| H6-U04 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Categoría EQUIPMENT | Consultar con `category=EQUIPMENT`; revisar filtro. | Se aplica la categoría EQUIPMENT. | Filtro EQUIPMENT enviado. | Aprobado |
| H6-U05 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Departamento sin municipio | Consultar con solo `department`; revisar filtro. | Se acepta el departamento como filtro. | Filtro de departamento enviado. | Aprobado |
| H6-U06 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Cambiar y quitar filtros | Consultar con filtros iniciales, cambiar categoría y volver a consultar omitiendo `noDeposit`. | Cada búsqueda usa los filtros actuales y devuelve sus resultados y total. | Las tres respuestas correspondieron a sus filtros; la última lista quedó vacía y total 0. | Aprobado |
| H6-U07 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Búsqueda sin coincidencias | Configurar repositorio mock para devolver lista vacía y total cero; llamar servicio. | Servicio devuelve `data: []` y `total: 0`. | `data: []`, `total: 0`, `page: 1`, `pageSize: 12`. | Aprobado |
| H6-U08 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Rol declarado para catálogo | Leer metadata de roles del endpoint `listCatalog`. | Solo TENANT tiene acceso. | Metadata contiene TENANT. | Aprobado |
| H6-U09 | Positiva | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | TENANT autorizado | Ejecutar RolesGuard con usuario TENANT. | El guard permite el acceso. | Guard devolvió true. | Aprobado |
| H6-U10 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Municipio sin departamento | Llamar servicio solo con `municipality`; revisar error y llamadas al repositorio. | Responde 400 y no consulta el repositorio. | Se rechazó con BadRequestException; repositorio no llamado. | Aprobado |
| H6-U11 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Texto menor al mínimo | Validar DTO con `q` de 1 carácter. | DTO rechaza la entrada. | Validación produjo error. | Aprobado |
| H6-U12 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Texto mayor al máximo | Validar DTO con `q` de 101 caracteres. | DTO rechaza la entrada. | Validación produjo error. | Aprobado |
| H6-U13 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Categoría inválida | Validar DTO con `category=OTRA`. | DTO rechaza la entrada. | Validación produjo error. | Aprobado |
| H6-U14 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | noDeposit inválido | Validar DTO con `noDeposit=sí`. | DTO rechaza la entrada. | Validación produjo error. | Aprobado |
| H6-U15 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | OWNER no autorizado | Revisar roles declarados por el endpoint. | OWNER no está autorizado. | OWNER no está en la metadata. | Aprobado |
| H6-U16 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Sin token de sesión | Ejecutar JwtAuthGuard sin encabezado Authorization. | Guard responde 401. | Rechazo con estado 401. | Aprobado |
| H6-U17 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Sin usuario autenticado | Ejecutar RolesGuard sin usuario en la solicitud. | Guard responde 401. | Rechazo con estado 401. | Aprobado |
| H6-U18 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Rol OWNER no autorizado | Ejecutar RolesGuard con usuario OWNER. | Guard responde 403. | Rechazo con estado 403. | Aprobado |
| H6-U19 | Negativa | Módulo 2: Búsqueda y filtros / H6: Búsqueda de bienes por criterios | Rol ADMIN no autorizado | Ejecutar RolesGuard con usuario ADMIN. | Guard responde 403. | Rechazo con estado 403. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H6.spec.ts` — Vitest reportó 1 archivo aprobado y 19 pruebas aprobadas.


## Módulo 2: Búsqueda y filtros — H8: Filtrar publicaciones por fechas disponibles (Unitarias)

### Casos positivos ejecutados

- **H8-U01:** El arrendatario puede enviar fechas ISO válidas de inicio y fin dentro del rango permitido.
- **H8-U02:** El sistema permite consultar el catálogo sin filtro cuando se omiten ambas fechas.
- **H8-U03:** El sistema combina el rango de fechas con los demás filtros del catálogo.
- **H8-U04:** El sistema excluye reservas `PAID`, reservas `PENDING` vigentes y bloqueos traslapados.
- **H8-U05:** El sistema actualiza los criterios del catálogo cuando cambian las fechas.
- **H8-U06:** El sistema acepta rangos de 30 días y la fecha límite del horizonte de 90 días.
- **H8-U07:** Solo TENANT tiene acceso al catálogo y el guard permite al arrendatario autenticado.

### Casos negativos ejecutados

- **H8-U08:** El sistema no acepta el filtro si falta una de las fechas.
- **H8-U09:** El sistema no acepta fechas ISO inválidas o fechas inexistentes.
- **H8-U10:** El sistema no permite fechas anteriores a hoy.
- **H8-U11:** El sistema no permite una fecha de fin anterior a la fecha de inicio.
- **H8-U12:** El sistema no permite rangos mayores de 30 días contando inicio y fin.
- **H8-U13:** El sistema no permite fechas posteriores al horizonte de 90 días.
- **H8-U14:** Una solicitud sin sesión no puede consultar el catálogo y recibe 401.
- **H8-U15:** Los usuarios OWNER y ADMIN no pueden consultar el catálogo y reciben 403.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H8-U01 | Positiva | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Fechas válidas | Validar el DTO con fechas ISO válidas y dentro de los límites. | El DTO acepta ambas fechas. | `class-validator` no reportó errores. | Aprobado |
| H8-U02 | Positiva | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Omitir el filtro de fechas | Validar el DTO sin fechas y consultar el servicio. | La consulta no aplica el filtro de disponibilidad. | El DTO pasó y el repositorio recibió únicamente estado AVAILABLE. | Aprobado |
| H8-U03 | Positiva | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Combinar filtros | Consultar con categoría, límites de precio, texto y rango de fechas; inspeccionar argumentos del repositorio. | Conserva todos los filtros y agrega disponibilidad en el mismo objeto de filtros. | El servicio envió los filtros combinados y mantuvo la búsqueda textual. | Aprobado |
| H8-U04 | Positiva | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Reservas y bloqueos que ocupan fechas | Inspeccionar los criterios construidos para fechas traslapadas, estado de reserva, vencimiento y bloqueos. | Excluye `PAID`, `PENDING` con vencimiento futuro y bloqueos traslapados; no incluye canceladas, completadas ni pendientes vencidas. | El filtro contiene únicamente `PAID` y `PENDING` con `expiresAt > ahora`, además de los bloqueos traslapados. | Aprobado |
| H8-U05 | Positiva | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Actualizar criterios al cambiar fechas | Consultar dos veces con rangos distintos e inspeccionar los filtros enviados. | Cada consulta usa las fechas actuales. | El repositorio recibió los dos rangos correspondientes. | Aprobado |
| H8-U06 | Positiva | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Límites inclusivos de 30 y 90 días | Validar un rango de 30 días inclusivos y otro de un día en la fecha máxima permitida. | Ambos rangos son aceptados. | Los dos DTO pasaron sin errores. | Aprobado |
| H8-U07 | Positiva | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Acceso TENANT al catálogo | Revisar metadata de roles y ejecutar RolesGuard con usuario TENANT. | El endpoint requiere TENANT y permite al usuario autorizado. | Metadata contiene TENANT y RolesGuard devolvió true. | Aprobado |
| H8-U08 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Falta una fecha | Validar solicitudes que contienen solo inicio o solo fin. | El DTO rechaza ambas solicitudes. | `class-validator` reportó errores para los dos casos. | Aprobado |
| H8-U09 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Formato o fecha inválida | Validar formato no ISO y fecha inexistente. | El DTO rechaza ambas solicitudes. | `class-validator` reportó errores para los dos casos. | Aprobado |
| H8-U10 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Fechas anteriores a hoy | Validar un inicio pasado y un rango completamente pasado. | El DTO rechaza las fechas anteriores a hoy. | `class-validator` reportó errores para ambos casos. | Aprobado |
| H8-U11 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Fin anterior al inicio | Validar un rango cuyo fin precede al inicio. | El DTO rechaza el rango. | `class-validator` reportó errores. | Aprobado |
| H8-U12 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Rango mayor a 30 días | Validar un rango de 31 días inclusivos. | El DTO rechaza el rango. | `class-validator` reportó errores. | Aprobado |
| H8-U13 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Fecha posterior al horizonte | Validar un rango que comienza después del día 90. | El DTO rechaza el rango. | `class-validator` reportó errores. | Aprobado |
| H8-U14 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Solicitud sin sesión | Ejecutar JwtAuthGuard sin encabezado Authorization. | Guard responde 401. | Rechazo con estado 401. | Aprobado |
| H8-U15 | Negativa | Módulo 2: Búsqueda y filtros / H8: Filtrar publicaciones por fechas disponibles | Roles OWNER y ADMIN sin permiso | Ejecutar RolesGuard con cada rol no autorizado. | Ambos roles reciben 403. | Ambos roles fueron rechazados con estado 403. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H8.spec.ts` — Vitest reportó 1 archivo aprobado y 15 pruebas aprobadas.

## Módulo 3: Reservas y calendario de disponibilidad — H9: Consulta de disponibilidad de un bien (Unitarias)

### Casos positivos ejecutados

- **H9-U01:** El arrendatario obtiene el rango de disponibilidad de 90 días desde la fecha actual de El Salvador.
- **H9-U02:** El rango de fechas comprende 90 días inclusivos desde hoy.
- **H9-U03:** Las fechas de reservas PENDING se incluyen como ocupadas.
- **H9-U04:** Las fechas de reservas PAID se incluyen como ocupadas.
- **H9-U05:** Los días bloqueados por el arrendador se incluyen como ocupados.
- **H9-U06:** Los periodos fuera del horizonte se recortan y los periodos traslapados no duplican días.
- **H9-U08:** El arrendador puede consultar su propio bien y los roles TENANT y OWNER están autorizados.
- **H9-U09:** La consulta obtiene solo rangos de fechas, sin datos personales de las reservas.

### Casos negativos ejecutados

- **H9-U11:** Las reservas CANCELLED y COMPLETED no se consideran ocupadas.
- **H9-U12:** Un bien inexistente, PAUSED o DELETED responde 404 con el mensaje «Este bien ya no está disponible».
- **H9-U15:** El arrendador no puede consultar la disponibilidad de un bien ajeno.
- **H9-U16:** El rol ADMIN recibe 403.
- **H9-U17:** Una solicitud sin sesión recibe 401.
- **H9-U18:** Un identificador que no sea UUID válido recibe 400.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H9-U01 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Respuesta de disponibilidad | Consultar como TENANT un bien AVAILABLE y revisar los campos devueltos. | Devuelve `propertyId`, `from`, `to` y `occupiedDates`. | La respuesta contiene los cuatro campos y el rango esperado. | Aprobado |
| H9-U02 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Rango de 90 días en El Salvador | Fijar la hora y consultar disponibilidad. | `from` es hoy y `to` completa 90 días inclusivos. | Respuesta del 2026-11-14 al 2027-02-11, 90 días inclusivos. | Aprobado |
| H9-U03 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Reserva PENDING ocupa fechas | Simular periodo PENDING y consultar disponibilidad. | Todos los días del periodo aparecen en `occupiedDates`. | Se devolvieron los días de la reserva PENDING. | Aprobado |
| H9-U04 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Reserva PAID ocupa fechas | Simular periodo PAID y consultar disponibilidad. | Todos los días del periodo aparecen en `occupiedDates`. | Se devolvieron los días de la reserva PAID. | Aprobado |
| H9-U05 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Bloqueo del arrendador | Simular bloqueo de tres días y consultar disponibilidad. | Los tres días aparecen como ocupados. | Se devolvieron los tres días del bloqueo. | Aprobado |
| H9-U06 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Periodos fuera del horizonte | Simular rangos que cruzan los límites de `from` y `to`. | Solo se devuelven días dentro del horizonte. | Los periodos se recortaron a 2026-11-14 y 2027-02-11. | Aprobado |
| H9-U07 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Periodos traslapados | Simular dos periodos parcialmente superpuestos. | Las fechas salen ordenadas y sin duplicados. | Se devolvió una lista única y ordenada. | Aprobado |
| H9-U08 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Consulta del arrendador propietario | Consultar como OWNER y verificar el propietario enviado al repositorio. | La consulta se limita al usuario autenticado. | Se envió `ownerId` junto con `propertyId`. | Aprobado |
| H9-U09 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Consulta sin datos personales | Inspeccionar filtros y campos seleccionados en Prisma y la respuesta del servicio. | Solo se seleccionan fechas de reservas PENDING/PAID y bloqueos; no se expone quién reservó. | Prisma seleccionó inicio y fin, y la respuesta no incluye `tenant`, `tenantId` ni reservas. | Aprobado |
| H9-U10 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Roles permitidos | Inspeccionar metadata y ejecutar RolesGuard como TENANT y OWNER. | Ambos roles pasan el guard. | La metadata incluye ambos roles y el guard autorizó a ambos. | Aprobado |
| H9-U11 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Estados CANCELLED y COMPLETED | Inspeccionar el filtro de reservas usado por Prisma. | Solo PENDING y PAID se consultan como ocupadas. | El filtro incluye PENDING y PAID; excluye CANCELLED y COMPLETED. | Aprobado |
| H9-U12 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Bien inexistente | Simular que el repositorio no encuentra el bien y consultar disponibilidad. | Responde 404 con el mensaje establecido y no consulta rangos. | NotFoundException 404 con «Este bien ya no está disponible»; no se consultaron rangos. | Aprobado |
| H9-U13 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Bien PAUSED | Simular bien no elegible y consultar disponibilidad. | Responde 404 con el mensaje establecido. | NotFoundException 404; no se consultaron rangos. | Aprobado |
| H9-U14 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Bien DELETED | Simular bien no elegible y consultar disponibilidad. | Responde 404 con el mensaje establecido. | NotFoundException 404; no se consultaron rangos. | Aprobado |
| H9-U15 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Bien ajeno al arrendador | Consultar como OWNER un bien que no aparece asociado a su usuario. | Responde 404 sin consultar rangos. | NotFoundException 404; se filtró por `ownerId` y no se consultaron rangos. | Aprobado |
| H9-U16 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Rol ADMIN | Ejecutar RolesGuard como ADMIN. | Responde 403. | RolesGuard rechazó el rol con estado 403. | Aprobado |
| H9-U17 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Solicitud sin sesión | Ejecutar JwtAuthGuard sin encabezado Authorization. | Responde 401. | JwtAuthGuard rechazó la solicitud con estado 401. | Aprobado |
| H9-U18 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H9: Consulta de disponibilidad de un bien | Identificador no UUID | Pasar texto inválido al ParseUUIDPipe. | Responde 400. | El pipe rechazó el identificador con BadRequestException. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H9.spec.ts` — Vitest reportó 1 archivo aprobado y 18 pruebas aprobadas.

## Módulo 7: Verificación de identidad/documentos — H19: Enviar documento de identidad para verificación (Unitarias)

### Casos positivos ejecutados

- **H19-U01:** Solo el usuario TENANT puede enviar un documento para verificar su cuenta.
- **H19-U02:** El tenant puede enviar un DUI válido con PDF y el sistema registra el documento como PENDING.
- **H19-U03:** El tenant puede enviar un pasaporte alfanumérico válido de seis caracteres.
- **H19-U12:** Después de un rechazo, el tenant puede enviar un documento nuevo y el trámite vuelve a PENDING.

### Casos negativos ejecutados

- **H19-U04:** El sistema no acepta un DUI cuyo número no cumple el formato 00000000-0.
- **H19-U05:** El sistema no acepta un pasaporte con caracteres distintos de letras y números.
- **H19-U06:** El sistema no permite enviar la solicitud si falta el archivo obligatorio.
- **H19-U07:** El sistema no acepta archivos que superen el límite de 5 MB.
- **H19-U08:** El sistema no acepta archivos con un formato distinto de JPG, PNG o PDF.
- **H19-U09:** Los usuarios OWNER y ADMIN no pueden enviar documentos de identidad.
- **H19-U10:** El sistema no permite enviar otro documento mientras el actual está PENDING.
- **H19-U11:** El sistema no permite enviar documentos cuando la cuenta ya está verificada.
### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H19-U01 | Positiva | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Rol TENANT requerido | Leer metadata del endpoint de envío. | Solo TENANT puede enviar. | Metadata declara únicamente TENANT. | Aprobado |
| H19-U02 | Positiva | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Envío de DUI con archivo PDF válido | Enviar como TENANT un DUI válido y PDF con firma correcta; revisar carga, persistencia y respuesta. | Se guarda el documento con estado PENDING y se devuelve el tipo y fecha. | El archivo se carga y el repositorio recibe los datos con estado PENDING; respuesta esperada. | Aprobado |
| H19-U03 | Positiva | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Pasaporte mínimo válido | Enviar pasaporte alfanumérico de 6 caracteres con PDF válido. | Se acepta y persiste el documento pendiente. | El documento fue aceptado y persistido. | Aprobado |
| H19-U04 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | DUI con formato incorrecto | Enviar DUI con 7 dígitos antes del guion. | 400 VALIDATION_ERROR y no se carga archivo. | BadRequestException; carga no invocada. | Aprobado |
| H19-U05 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Pasaporte con caracteres no alfanuméricos | Enviar pasaporte con guion. | 400 VALIDATION_ERROR y no se carga archivo. | BadRequestException; carga no invocada. | Aprobado |
| H19-U06 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Archivo obligatorio ausente | Omitir el archivo. | 400 VALIDATION_ERROR. | BadRequestException; carga no invocada. | Aprobado |
| H19-U07 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Archivo mayor de 5 MB | Simular archivo mayor al límite. | 400 y archivo no se carga. | BadRequestException; carga no invocada. | Aprobado |
| H19-U08 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | MIME no permitido | Enviar text/plain. | 400 y archivo no se carga. | BadRequestException; carga no invocada. | Aprobado |
| H19-U09 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Rol OWNER o ADMIN intenta enviar | Invocar el servicio con cada rol no permitido. | Ambos reciben 403 y no se consulta ni carga el documento. | Ambos rechazados con ForbiddenException antes de consultar perfil o cargar archivo. | Aprobado |
| H19-U10 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Reenvío mientras hay documento pendiente | Configurar perfil con documento PENDING e intentar enviar otro. | 409 DOCUMENT_PENDING y no se carga otro archivo. | ConflictException; carga no invocada. | Aprobado |
| H19-U11 | Negativa | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Envío con cuenta verificada | Configurar perfil verificado e intentar enviar documento. | 409 ACCOUNT_ALREADY_VERIFIED. | ConflictException; carga no invocada. | Aprobado |
| H19-U12 | Positiva | Módulo 7: Verificación de identidad/documentos / H19: Enviar documento de identidad para verificación | Reenvío después de rechazo | Configurar documento REJECTED con motivo y enviar uno válido. | Se actualiza el registro a PENDING y se limpia el motivo previo. | Se actualizó a PENDING, se limpió el motivo y se solicitó borrar el archivo anterior. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H19.spec.ts` — Vitest reportó 1 archivo aprobado y 12 pruebas aprobadas.

## Módulo 7: Verificación de identidad/documentos — H20: Aprobar o rechazar documentos de identidad enviados (Unitarias)

### Casos positivos ejecutados

- **H20-U01:** El administrador consulta documentos PENDING con página 1 y 10 documentos por página por defecto.
- **H20-U02:** El sistema aplica el desplazamiento y el límite correspondientes a la página solicitada.
- **H20-U03:** El listado incluye nombre, correo, tipo, número y fecha de envío del documento.
- **H20-U04:** El sistema devuelve una lista vacía y total cero cuando no hay documentos pendientes.
- **H20-U05:** El administrador puede consultar un documento pendiente y obtener un enlace temporal al archivo privado.
- **H20-U06:** Al aprobar, el sistema cambia el documento a APPROVED, verifica el perfil y registra cuándo se revisó.
- **H20-U07:** El sistema acepta un motivo de rechazo de 10 caracteres y guarda el documento como REJECTED con la fecha de revisión.
- **H20-U08:** El sistema acepta un motivo de rechazo de 300 caracteres.
- **H20-U09:** El sistema permite al rol ADMIN acceder a las rutas de revisión.
- **H20-U21:** El repositorio filtra documentos PENDING, los ordena del más antiguo al más reciente y aplica el límite de 10.

### Casos negativos ejecutados

- **H20-U10:** El sistema rechaza un motivo ausente o vacío.
- **H20-U11:** El sistema rechaza un motivo de 9 caracteres.
- **H20-U12:** El sistema rechaza un motivo de 301 caracteres.
- **H20-U13:** El sistema responde 404 al consultar un documento inexistente o que no está pendiente.
- **H20-U14:** El sistema no permite volver a revisar un documento APPROVED.
- **H20-U15:** El sistema no permite volver a revisar un documento REJECTED.
- **H20-U16:** Una solicitud sin sesión recibe 401.
- **H20-U17:** Un usuario TENANT no puede consultar ni revisar documentos.
- **H20-U18:** Un usuario OWNER no puede consultar ni revisar documentos.
- **H20-U19:** El guard de roles responde 401 cuando falta el usuario autenticado.
- **H20-U20:** El sistema responde 409 si otra revisión concurrente ya modificó el documento.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H20-U01 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Paginación por defecto | Crear DTO sin parámetros y consultar el servicio. | Página 1 y pageSize 10; consultar pendientes desde el inicio. | DTO usó página 1 y límite 10; repositorio recibió skip 0 y take 10. | Aprobado |
| H20-U02 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Paginación solicitada | Validar page 3 y pageSize 10; consultar servicio. | El repositorio recibe skip 20 y take 10. | class-validator aceptó la consulta y el repositorio recibió skip 20 y take 10. | Aprobado |
| H20-U03 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Campos del listado | Listar un documento pendiente con usuario asociado. | La fila contiene usuario, correo, tipo, número y fecha de envío. | La respuesta incluyó todos los campos con los valores esperados. | Aprobado |
| H20-U04 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Lista sin pendientes | Simular cero resultados y cero total. | Responde data vacía y total 0. | El servicio devolvió data [] y total 0. | Aprobado |
| H20-U05 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Detalle y archivo pendiente | Consultar usuario con documento PENDING y generar enlace temporal. | El detalle incluye datos del documento y enlace privado firmado. | Se consultó el documento pendiente y se devolvió el enlace temporal esperado. | Aprobado |
| H20-U06 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Aprobar documento | Fijar la hora, aprobar y revisar actualización transaccional y respuesta. | Documento APPROVED, perfil verificado y reviewedAt guardado. | El repositorio actualizó estado y perfil; la respuesta incluyó reviewedAt. | Aprobado |
| H20-U07 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Rechazo con motivo mínimo | Enviar rejectionReason de 10 caracteres y revisar persistencia y respuesta. | Documento REJECTED con motivo y reviewedAt. | El motivo se guardó, el perfil quedó sin verificar y se devolvió reviewedAt. | Aprobado |
| H20-U08 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Rechazo con motivo máximo | Validar y enviar rejectionReason de 300 caracteres. | El motivo se acepta y se guarda. | DTO válido y servicio aceptó los 300 caracteres. | Aprobado |
| H20-U09 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Rol ADMIN autorizado | Leer metadata de las cuatro rutas y ejecutar RolesGuard como ADMIN. | Las rutas requieren ADMIN y el guard autoriza el rol. | Todas declaran ADMIN y RolesGuard devolvió true. | Aprobado |
| H20-U10 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Motivo ausente, vacío o compuesto por espacios | Validar DTO sin rejectionReason y con cadena vacía; enviar un motivo de espacios al servicio. | Se rechazan los tres motivos y no inicia la transacción. | class-validator encontró errores para campo ausente y cadena vacía; el servicio respondió 400 al motivo de espacios sin iniciar transacción. | Aprobado |
| H20-U11 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Motivo menor al mínimo | Validar y enviar rejectionReason de 9 caracteres. | Responde 400 y no inicia la transacción. | DTO inválido; servicio lanzó 400 sin iniciar transacción. | Aprobado |
| H20-U12 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Motivo mayor al máximo | Validar y enviar rejectionReason de 301 caracteres. | Responde 400 y no inicia la transacción. | DTO inválido; servicio lanzó 400 sin iniciar transacción. | Aprobado |
| H20-U13 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Documento inexistente o no pendiente | Simular que el repositorio no encuentra documento pendiente y consultar detalle. | Responde 404 y no genera enlace al archivo. | NotFoundException; no se generó enlace. | Aprobado |
| H20-U14 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Documento ya aprobado | Intentar revisar un documento APPROVED. | Responde 409 y no inicia transacción. | ConflictException; transacción no invocada. | Aprobado |
| H20-U15 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Documento ya rechazado | Intentar revisar un documento REJECTED. | Responde 409 y no inicia transacción. | ConflictException; transacción no invocada. | Aprobado |
| H20-U16 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Solicitud sin sesión | Ejecutar JwtAuthGuard sin encabezado Authorization. | Guard responde 401. | El guard rechazó la solicitud con estado 401. | Aprobado |
| H20-U17 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Rol TENANT sin permiso | Ejecutar RolesGuard con usuario TENANT. | Guard responde 403. | RolesGuard rechazó el rol con estado 403. | Aprobado |
| H20-U18 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Rol OWNER sin permiso | Ejecutar RolesGuard con usuario OWNER. | Guard responde 403. | RolesGuard rechazó el rol con estado 403. | Aprobado |
| H20-U19 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Usuario ausente en RolesGuard | Ejecutar RolesGuard sin usuario autenticado en la solicitud. | Guard responde 401. | RolesGuard rechazó la solicitud con estado 401. | Aprobado |
| H20-U20 | Negativa | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Revisión concurrente | Simular que la actualización condicional no modifica filas. | Responde 409 y no verifica el perfil. | ConflictException con 409; perfil no actualizado. | Aprobado |
| H20-U21 | Positiva | Módulo 7: Verificación de identidad/documentos / H20: Aprobar o rechazar documentos de identidad enviados | Consulta de pendientes en repositorio | Ejecutar findPendingDocuments y countPendingDocuments con Prisma simulado. | Filtra PENDING, ordena submittedAt ascendente, omite 0 y toma 10. | Prisma recibió el filtro, orden ascendente y paginación esperados. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H20.spec.ts` — Vitest reportó 1 archivo aprobado y 21 pruebas aprobadas.

Nota: no se probaron las notificaciones porque el servicio del Módulo 8 no existe todavía en este backend. Los mensajes, botones y estados visuales pertenecen al frontend y no se cubren con estas pruebas unitarias.

## Módulo 8: Notificaciones — H22: Centralizar la generación y despacho de notificaciones (Unitarias)

### Casos positivos ejecutados

- **H22-U01:** El servicio persiste una notificación válida como `UNREAD` y devuelve el registro con su fecha de creación.
- **H22-U02:** El servicio acepta un título de 100 caracteres y un mensaje de 250 caracteres.
- **H22-U03:** El servicio genera los títulos y mensajes de plantilla para los diez eventos definidos.
- **H22-U04:** El servicio acepta los cuatro valores definidos para `OriginModule`.
- **H22-U05:** El servicio guarda `null` cuando no se proporciona la referencia opcional.
- **H22-U06:** El repository delega la creación a Prisma y devuelve el registro resultante.
- **H22-U07:** Al aprobar un documento, se solicita una notificación `DOCUMENT_APPROVED` para su usuario.
- **H22-U08:** Al rechazar un documento, se solicita una notificación `DOCUMENT_REJECTED` con el motivo.

### Casos negativos ejecutados

- **H22-U09:** El servicio rechaza la ausencia de destinatario y no persiste una notificación.
- **H22-U10:** El servicio rechaza un destinatario con UUID inválido.
- **H22-U11:** El servicio responde 404 cuando el destinatario no existe y no persiste una notificación.
- **H22-U12:** El servicio rechaza un evento fuera de `NotificationEventType`.
- **H22-U13:** El servicio rechaza un título ausente o vacío.
- **H22-U14:** El servicio rechaza un título de más de 100 caracteres.
- **H22-U15:** El servicio rechaza un mensaje ausente o vacío.
- **H22-U16:** El servicio rechaza un mensaje de más de 250 caracteres.
- **H22-U17:** El servicio rechaza un módulo de origen ausente o fuera de `OriginModule`.
- **H22-U18:** El servicio rechaza una referencia opcional con UUID inválido.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H22-U01 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Registro y estado por defecto | Invocar `emit` con datos válidos y referencia UUID. | El repository recibe la notificación como `UNREAD`; se devuelve el registro con fecha de creación. | El payload incluyó los datos esperados y estado `UNREAD`; el resultado devolvió la fecha configurada por el mock. | Aprobado |
| H22-U02 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Límites máximos permitidos | Invocar `emit` con título de 100 y mensaje de 250 caracteres. | La solicitud se acepta y se crea la notificación. | La llamada terminó correctamente y devolvió la notificación `UNREAD`. | Aprobado |
| H22-U03 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Plantillas de los eventos definidos | Invocar `emit` para los diez tipos de evento con datos de plantilla representativos. | Cada evento genera el título y mensaje unificados correspondientes. | Los diez eventos devolvieron los títulos y fragmentos de mensaje esperados. | Aprobado |
| H22-U04 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Módulos de origen válidos | Invocar `emit` usando cada valor de `OriginModule`. | Los cuatro valores son aceptados y persistidos. | `RESERVATIONS`, `PAYMENTS`, `MESSAGING` y `VERIFICATION` fueron aceptados. | Aprobado |
| H22-U05 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Referencia opcional omitida | Invocar `emit` sin `referenceId` y revisar el payload de creación. | La notificación se crea con referencia nula. | El repository recibió `referenceId: null`. | Aprobado |
| H22-U06 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Persistencia delegada a Prisma | Invocar `NotificationsRepository.create` con Prisma simulado. | Prisma recibe `notification.create({ data })` y el repository devuelve el registro. | Se llamó a Prisma con el payload esperado y se devolvió el registro simulado. | Aprobado |
| H22-U07 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Aviso de documento aprobado | Aprobar un documento pendiente y observar la llamada al servicio de notificaciones. | Se solicita `DOCUMENT_APPROVED` para el usuario, con origen `VERIFICATION` y referencia del documento. | `emit` recibió el destinatario, evento, origen y referencia esperados. | Aprobado |
| H22-U08 | Positiva | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Aviso de documento rechazado | Rechazar un documento pendiente con motivo válido. | Se solicita `DOCUMENT_REJECTED` y se proporciona el motivo a la plantilla. | `emit` recibió el evento y `templateData` con el motivo esperado. | Aprobado |
| H22-U09 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Destinatario ausente | Invocar `emit` sin `recipientId`. | Responde 400 y no persiste la notificación. | Se lanzó `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U10 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | UUID de destinatario inválido | Invocar `emit` con texto que no tiene formato UUID. | Responde 400. | Se lanzó `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U11 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Destinatario inexistente | Configurar el repository para no encontrar el UUID y llamar `emit`. | Responde 404 y no persiste la notificación. | Se lanzó `NotFoundException`; `create` no fue llamado. | Aprobado |
| H22-U12 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Evento inválido | Invocar `emit` con un valor fuera de `NotificationEventType`. | Responde 400 y no persiste la notificación. | Se lanzó `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U13 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Título ausente o vacío | Invocar `emit` sin título y con título compuesto por espacios. | Ambos casos responden 400 y no persisten. | Ambos casos lanzaron `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U14 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Título fuera de límite | Invocar `emit` con título de 101 caracteres. | Responde 400 y no persiste. | Se lanzó `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U15 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Mensaje ausente o vacío | Invocar `emit` sin mensaje y con mensaje compuesto por espacios. | Ambos casos responden 400 y no persisten. | Ambos casos lanzaron `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U16 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Mensaje fuera de límite | Invocar `emit` con mensaje de 251 caracteres. | Responde 400 y no persiste. | Se lanzó `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U17 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Módulo de origen ausente o inválido | Invocar `emit` sin origen y con valor fuera de `OriginModule`. | Ambos casos responden 400 y no persisten. | Ambos casos lanzaron `BadRequestException`; `create` no fue llamado. | Aprobado |
| H22-U18 | Negativa | Módulo 8: Notificaciones / H22: Centralizar la generación y despacho de notificaciones | Referencia UUID inválida | Invocar `emit` con `referenceId` mal formado. | Responde 400 y no persiste. | Se lanzó `BadRequestException`; `create` no fue llamado. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H22.spec.ts` — Vitest reportó 1 archivo aprobado y 18 pruebas aprobadas.


## Módulo 8: Notificaciones — H23: Consultar y gestionar notificaciones (Pruebas unitarias)

### Casos positivos ejecutados

- **H23-U01:** El usuario autenticado puede consultar sus notificaciones ordenadas de la más reciente a la más antigua.
- **H23-U02:** Cada notificación incluye título, mensaje, fecha y hora de emisión, módulo de origen y estado, junto con los datos de paginación.
- **H23-U03:** El sistema devuelve la bandeja paginada de 10 en 10 registros por defecto.
- **H23-U04:** El usuario puede consultar la página siguiente sin repetir notificaciones de la página anterior.
- **H23-U05:** El contador muestra la cantidad de notificaciones `UNREAD` del usuario autenticado.
- **H23-U06:** El usuario puede marcar una notificación propia como `READ` y el contador de no leídas disminuye en uno.
- **H23-U07:** El usuario puede marcar todas sus notificaciones pendientes como leídas y el sistema devuelve la cantidad actualizada.
- **H23-U08:** Si no hay notificaciones, el sistema devuelve una lista vacía y total cero.
- **H23-U09:** Los usuarios autenticados con rol `TENANT` o `OWNER` pueden consultar y gestionar su propia bandeja.
- **H23-U16:** El repositorio limita la consulta al usuario autenticado y ordena los registros por fecha descendente.

### Casos negativos ejecutados

- **H23-U10:** El sistema rechaza una página cero o negativa con respuesta 400.
- **H23-U11:** El sistema rechaza un límite no entero, menor que 1 o mayor que 100 con respuesta 400.
- **H23-U12:** El sistema no permite marcar como leída una notificación de otro usuario y responde 403.
- **H23-U13:** El sistema responde 404 cuando se intenta marcar una notificación inexistente.
- **H23-U14:** Una solicitud sin sesión no puede consultar ni modificar la bandeja y recibe 401.
- **H23-U15:** El usuario con rol `ADMIN` no puede consultar ni gestionar la bandeja y recibe 403.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H23-U01 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Bandeja ordenada para el usuario actual | Consultar la página inicial con el ID del usuario y comparar fechas consecutivas. | Se consultan solo sus registros, del más reciente al más antiguo. | El servicio consulta con el ID de sesión y la lista queda en orden descendente. | Aprobado |
| H23-U02 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Datos de cada notificación y paginación | Consultar bandeja con avisos de estados y orígenes distintos. | La respuesta conserva título, mensaje, fecha, origen, estado y metadatos de página. | La respuesta contiene los campos de aviso y `total`, `page`, `limit` y `totalPages`. | Aprobado |
| H23-U03 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Límite predeterminado de página | Crear el DTO por defecto y consultar con sus valores. | La primera página consulta 10 registros. | El DTO usa página 1 y límite 10; el repositorio recibe `skip: 0`, `take: 10`. | Aprobado |
| H23-U04 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Consulta de página siguiente | Consultar página 2 con límite 10 y revisar el desplazamiento solicitado. | La consulta empieza después de los primeros 10 registros. | El repositorio recibe `skip: 10`, `take: 10`. | Aprobado |
| H23-U05 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Contador de no leídas | Consultar el contador del usuario autenticado. | Devuelve `{ unreadCount: 2 }` para dos registros `UNREAD`. | El servicio delegó el conteo con el ID del usuario y devolvió 2. | Aprobado |
| H23-U06 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Marcar una notificación como leída | Consultar contador, marcar aviso propio y consultar contador nuevamente. | La notificación cambia a `READ` y el contador baja en uno. | La respuesta quedó en `READ`; el contador pasó de 2 a 1. | Aprobado |
| H23-U07 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Marcar todas como leídas | Solicitar marcado en lote para el usuario actual. | Actualiza sus pendientes y devuelve `updatedCount`. | El repositorio se invocó con el ID del usuario y la respuesta fue `{ updatedCount: 2 }`. | Aprobado |
| H23-U08 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Bandeja sin notificaciones | Simular lista y total vacíos y consultar la página inicial. | Devuelve lista vacía y total cero. | La respuesta fue `{ data: [], total: 0, page: 1, limit: 10, totalPages: 0 }`. | Aprobado |
| H23-U09 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Acceso para roles permitidos | Ejecutar `RolesGuard` para `TENANT` y `OWNER`. | Ambos roles pueden acceder con sesión. | El guard permitió el acceso para ambos roles. | Aprobado |
| H23-U10 | Negativa | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Página cero o negativa | Validar DTO con página 0 y -1. | Ambos valores son rechazados con error 400. | La validación produjo errores para ambos valores. | Aprobado |
| H23-U11 | Negativa | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Límite de página inválido | Validar DTO con límite 0, 101, decimal y texto no numérico. | Todos los valores inválidos son rechazados con error 400. | La validación produjo errores para los cuatro valores. | Aprobado |
| H23-U12 | Negativa | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Aviso perteneciente a otro usuario | Intentar marcar un aviso cuyo `recipientId` es distinto al usuario de sesión. | Responde 403 y no modifica el aviso. | Se lanzó `ForbiddenException` y `markRead` no fue invocado. | Aprobado |
| H23-U13 | Negativa | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Aviso inexistente | Intentar marcar un ID que no existe. | Responde 404 y no modifica registros. | Se lanzó `NotFoundException` y `markRead` no fue invocado. | Aprobado |
| H23-U14 | Negativa | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Consulta sin sesión | Ejecutar `JwtAuthGuard` sin encabezado de autorización. | El guard rechaza la solicitud con 401. | Se lanzó `UnauthorizedException`. | Aprobado |
| H23-U15 | Negativa | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Rol ADMIN no permitido | Ejecutar `RolesGuard` para `ADMIN` en las rutas de notificaciones. | El guard rechaza el acceso con respuesta 403. | Se lanzó `ForbiddenException`. | Aprobado |
| H23-U16 | Positiva | Módulo 8: Notificaciones / H23: Consultar y gestionar notificaciones | Filtro de destinatario y orden en persistencia | Inspeccionar la consulta Prisma de lista para un usuario y página. | Prisma filtra por destinatario y ordena `createdAt` descendente. | La consulta incluyó `recipientId`, orden descendente, `skip: 0` y `take: 10`. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H23.spec.ts` — Vitest reportó 1 archivo aprobado y 16 pruebas aprobadas.

## Módulo 3: Reservas y calendario de disponibilidad — H10: Reserva de un bien por un periodo (Unitarias)

### Casos positivos ejecutados

- **H10-U01:** El arrendatario TENANT verificado crea una reserva dentro de una transacción serializable.
- **H10-U02:** El sistema cuenta inicio y fin y calcula el subtotal con el precio guardado del bien.
- **H10-U03:** Si inicio y fin coinciden, el periodo cuenta como un día.
- **H10-U04:** La reserva queda PENDING y vence 24 horas después.
- **H10-U05:** La respuesta incluye el mensaje de confirmación y el plazo de pago.
- **H10-U06:** Al crear la reserva, se notifica al arrendador con RESERVATION_CREATED y origen RESERVATIONS.
- **H10-U07:** Se permite crear una reserva cuando el periodo no tiene traslapes ni bloqueos.
- **H10-U08:** Mis reservas filtra por el tenant autenticado y aplica estado y paginación.
- **H10-U09:** Reservas de mis bienes filtra por el owner autenticado e incluye el nombre del arrendatario.
- **H10-U10:** Al vencer una reserva PENDING, el servicio solicita notificaciones para ambas partes.
- **H10-U11:** El DTO acepta UUID y fechas válidas con formato YYYY-MM-DD.
- **H10-U12:** Las rutas declaran TENANT para reserva y consulta propia, y OWNER para consultar reservas de sus bienes.

### Casos negativos ejecutados

- **H10-U13a/b:** Se rechazan fechas inexistentes o con formato inválido.
- **H10-U14:** Se rechaza una fecha de fin anterior al inicio.
- **H10-U15:** Se rechaza un periodo mayor a 30 días inclusivos.
- **H10-U16a/b:** Se rechazan fechas anteriores a hoy o posteriores al horizonte de 90 días.
- **H10-U17:** Se rechaza un propertyId que no sea UUID.
- **H10-U18:** Se rechazan campos no permitidos en el cuerpo de la solicitud.
- **H10-U19:** Un perfil no verificado recibe 403 y no se crea la reserva.
- **H10-U20:** Un bien inexistente o no disponible responde 404.
- **H10-U21:** Un traslape con reserva activa responde 409 y no crea otra reserva.
- **H10-U22:** Un traslape con bloqueo responde 409 y no crea una reserva.
- **H10-U23:** Un conflicto de serialización concurrente responde 409 con el mensaje de fechas ocupadas.
- **H10-U24:** OWNER y ADMIN reciben 403 al intentar crear una reserva.
- **H10-U25:** Una solicitud sin sesión recibe 401.
- **H10-U26:** La consulta del arrendatario no incluye reservas de otros usuarios.
- **H10-U27:** La consulta del arrendador no incluye reservas de bienes ajenos.
- **H10-U28a/d:** Se rechazan estado, página, tamaño de página o propertyId inválidos en las consultas.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H10-U01 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Crear como arrendatario verificado | Simular perfil verificado, bien disponible y periodo libre; llamar al servicio. | Crea dentro de una transacción serializable. | Se verificó el perfil, se consultó el bien y se creó la reserva dentro de la transacción. | Aprobado |
| H10-U02 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Subtotal inclusivo de tres días | Reservar del 2026-11-20 al 2026-11-22 con precio diario 50.00. | Cuenta 3 días y subtotal 150.00. | El repositorio recibió el periodo inclusivo y subtotal 150.00. | Aprobado |
| H10-U03 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Periodo de un día | Enviar la misma fecha de inicio y fin con precio diario 50.00. | Cuenta 1 día y subtotal 50.00. | El periodo tuvo un día y subtotal 50.00. | Aprobado |
| H10-U04 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Estado y vencimiento inicial | Crear reserva con reloj fijo y revisar persistencia y respuesta. | Estado PENDING y vencimiento exactamente 24 horas después. | Respuesta PENDING; expiresAt quedó en 2026-11-17T18:00:00.000Z. | Aprobado |
| H10-U05 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Mensaje de confirmación | Crear una reserva válida y revisar el mensaje de respuesta. | Incluye «Reserva creada. Tienes 24 horas para pagarla.». | La respuesta contiene el mensaje esperado. | Aprobado |
| H10-U06 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Aviso al arrendador | Crear reserva y revisar argumentos de NotificationsService.emit. | Se notifica al owner con RESERVATION_CREATED y RESERVATIONS. | Se llamó emit con destinatario, evento, origen y referencia esperados. | Aprobado |
| H10-U07 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Periodo libre | Simular ausencia de reservas activas y bloqueos, y crear reserva. | La solicitud crea la reserva. | Se consultaron ambos traslapes y se creó la reserva. | Aprobado |
| H10-U08 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Mis reservas y paginación | Consultar con tenant autenticado, page 2, pageSize 5 y status PENDING. | Devuelve solo las reservas del tenant con filtros y paginación. | El repositorio recibió tenantId y filtros; respuesta incluyó total y page solicitados. | Aprobado |
| H10-U09 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Reservas de bienes propios | Consultar como owner con propertyId y estado, incluyendo tenant relacionado. | Devuelve reserva de bien propio con tenant.name. | Repositorio recibió ownerId y la respuesta incluyó el nombre del arrendatario. | Aprobado |
| H10-U10 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Vencimiento y avisos a ambas partes | Procesar una reserva vencida devuelta por el repositorio. | Se cancela y se emite aviso al tenant y al owner. | Se solicitó el procesamiento y se emitieron dos avisos RESERVATION_CANCELED_EXPIRED. | Aprobado |
| H10-U11 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | DTO con datos válidos | Validar propertyId UUID y fechas válidas. | DTO válido. | class-validator no encontró errores. | Aprobado |
| H10-U12 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Roles de las rutas | Inspeccionar metadata y ejecutar RolesGuard para TENANT. | TENANT puede reservar y consultar sus reservas; OWNER consulta las suyas. | Metadata declaró los roles esperados y el guard autorizó TENANT. | Aprobado |
| H10-U13a | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Fecha inexistente | Enviar 2026-02-30 como fecha de inicio. | Responde 400 antes de iniciar la transacción. | BadRequestException; la transacción no se invocó. | Aprobado |
| H10-U13b | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Formato de fecha inválido | Enviar fecha con formato DD-MM-YYYY. | Responde 400 antes de iniciar la transacción. | BadRequestException; la transacción no se invocó. | Aprobado |
| H10-U14 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Fin anterior al inicio | Enviar inicio 2026-11-22 y fin 2026-11-21. | Responde 400 y no consulta el repositorio. | BadRequestException; la transacción no se invocó. | Aprobado |
| H10-U15 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Periodo mayor a 30 días | Enviar periodo inclusivo de 31 días. | Responde 400 antes de iniciar la transacción. | BadRequestException; la transacción no se invocó. | Aprobado |
| H10-U16a | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Fechas pasadas | Enviar fechas anteriores a hoy. | Responde 400. | BadRequestException; la transacción no se invocó. | Aprobado |
| H10-U16b | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Fuera del horizonte | Enviar fecha final posterior a los próximos 90 días. | Responde 400. | BadRequestException; la transacción no se invocó. | Aprobado |
| H10-U17 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | propertyId inválido | Validar DTO con valor no UUID. | DTO inválido con error 400 al pasar por ValidationPipe. | class-validator encontró errores en propertyId. | Aprobado |
| H10-U18 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Campo adicional no permitido | Enviar subtotal adicional usando ValidationPipe estricto. | Rechaza la solicitud con 400. | ValidationPipe lanzó BadRequestException. | Aprobado |
| H10-U19 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Perfil sin verificar | Simular isVerified false e intentar crear. | Responde 403 y no crea la reserva. | ForbiddenException; no se buscó el bien ni se creó reserva. | Aprobado |
| H10-U20 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Bien inexistente o no disponible | Simular que no se encuentra bien AVAILABLE. | Responde 404 y no crea la reserva. | NotFoundException; no se creó reserva. | Aprobado |
| H10-U21 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Traslape con reserva activa | Simular una reserva activa en fechas coincidentes. | Responde 409 DATES_UNAVAILABLE. | ConflictException con mensaje de fechas no disponibles; no se creó reserva. | Aprobado |
| H10-U22 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Traslape con bloqueo | Simular bloqueo del arrendador en el periodo solicitado. | Responde 409 DATES_UNAVAILABLE. | ConflictException; no se creó reserva. | Aprobado |
| H10-U23 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Solicitudes concurrentes | Simular error de serialización Prisma P2034. | Responde 409 con mensaje para elegir otras fechas. | El error P2034 se convirtió a DATES_UNAVAILABLE. | Aprobado |
| H10-U24 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | OWNER y ADMIN intentan reservar | Ejecutar RolesGuard con OWNER y ADMIN en endpoint de creación. | Ambos reciben 403. | RolesGuard rechazó ambos roles con estado 403. | Aprobado |
| H10-U25 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Solicitud sin sesión | Ejecutar JwtAuthGuard sin Authorization. | Responde 401. | JwtAuthGuard rechazó la solicitud con estado 401. | Aprobado |
| H10-U26 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Privacidad de Mis reservas | Inspeccionar filtros Prisma para la consulta del arrendatario. | findMany y count filtran por tenantId autenticado. | Ambas consultas recibieron únicamente el tenantId de sesión. | Aprobado |
| H10-U27 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Privacidad de reservas del arrendador | Inspeccionar filtro de propietario y selección del tenant. | Limita por property.ownerId y solo selecciona tenant.name. | Prisma recibió ownerId autenticado y seleccionó únicamente el nombre del tenant. | Aprobado |
| H10-U28a | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Página inválida | Validar page 0. | DTO inválido. | class-validator encontró errores. | Aprobado |
| H10-U28b | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Tamaño de página fuera del máximo | Validar pageSize 101. | DTO inválido. | class-validator encontró errores. | Aprobado |
| H10-U28c | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | Estado inválido | Validar status UNKNOWN. | DTO inválido. | class-validator encontró errores. | Aprobado |
| H10-U28d | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H10: Reserva de un bien por un periodo | propertyId de filtro inválido | Validar propertyId no UUID en consulta OWNER. | DTO inválido. | class-validator encontró errores. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H10.spec.ts` — Vitest reportó 1 archivo aprobado y 33 pruebas aprobadas.


## Módulo 3: Reservas y calendario de disponibilidad — H12: Bloqueo de fechas no disponibles (Unitarias)

### Casos positivos ejecutados

- **H12-U01:** El arrendador crea un bloqueo válido y recibe sus datos principales.
- **H12-U02:** La lista incluye bloqueos que terminan hoy o después, ordenados por inicio.
- **H12-U03:** Si no hay bloqueos vigentes, el sistema devuelve una lista vacía.
- **H12-U04:** El arrendador puede eliminar un bloqueo de su propio bien.
- **H12-U05:** Los días bloqueados aparecen como ocupados en el calendario.
- **H12-U06:** Al eliminar un bloqueo, sus días vuelven a estar libres si ninguna reserva los ocupa.
- **H12-U07:** Las rutas de bloqueos permiten el acceso al rol OWNER.

### Casos negativos ejecutados

- **H12-U08:** El sistema rechaza fechas ausentes, con formato inválido o inexistentes en el calendario.
- **H12-U09:** El sistema no permite iniciar un bloqueo antes de hoy.
- **H12-U10:** El sistema no permite que la fecha de fin sea anterior a la de inicio.
- **H12-U11:** El sistema no permite fechas posteriores al horizonte de 90 días.
- **H12-U12:** El sistema rechaza traslapes con otro bloqueo.
- **H12-U13:** El sistema rechaza traslapes con reservas PENDING.
- **H12-U14:** El sistema rechaza traslapes con reservas PAID.
- **H12-U15:** El sistema no permite bloquear un bien ajeno o inexistente.
- **H12-U16:** El sistema no permite consultar bloqueos de un bien ajeno o inexistente.
- **H12-U17:** El sistema responde que no encuentra un bloqueo inexistente al eliminarlo.
- **H12-U18:** El sistema no permite eliminar un bloqueo perteneciente a otro arrendador.
- **H12-U19:** Los roles TENANT y ADMIN reciben 403; una solicitud sin sesión recibe 401.
- **H12-U20:** El sistema rechaza identificadores que no tengan formato UUID en las tres rutas.
- **H12-U21:** Un conflicto de serialización al crear se convierte en 409.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H12-U01 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Crear bloqueo válido | Simular bien propio y periodo libre; llamar al servicio de creación. | Guarda el bloqueo en transacción serializable y responde con id, propertyId, fechas y createdAt. | Se verificó propiedad, se consultaron traslapes y se creó el bloqueo; la respuesta incluyó los cinco campos. | Aprobado |
| H12-U02 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Listado vigente ordenado | Invocar el repositorio para listar bloqueos desde hoy. | Filtra endDate mayor o igual a hoy y ordena por startDate ascendente. | Prisma recibió el filtro inclusivo y el orden ascendente por inicio. | Aprobado |
| H12-U03 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Lista vacía | Consultar los bloqueos del bien propio cuando el repositorio no devuelve filas. | Devuelve una lista vacía. | El servicio devolvió `[]`. | Aprobado |
| H12-U04 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Eliminar bloqueo propio | Simular bloqueo y bien del OWNER; solicitar eliminación. | Elimina el bloqueo propio y la operación termina sin cuerpo. | El servicio verificó propiedad y llamó al repositorio para eliminar el bloqueo. | Aprobado |
| H12-U05 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Días bloqueados en calendario | Devolver un bloqueo de tres días y consultar disponibilidad. | Los tres días aparecen en `occupiedDates`. | La respuesta incluyó 2026-11-20, 2026-11-21 y 2026-11-22. | Aprobado |
| H12-U06 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Liberar días al eliminar | Consultar disponibilidad antes y después de eliminar el bloqueo, sin reservas presentes. | Los días ocupados por el bloqueo dejan de aparecer tras eliminarlo. | Antes aparecieron tres días y después la lista quedó vacía. | Aprobado |
| H12-U07 | Positiva | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Rol OWNER permitido | Inspeccionar metadata y ejecutar RolesGuard para las tres rutas. | Las tres rutas declaran OWNER y el guard lo autoriza. | La metadata y el guard confirmaron el acceso OWNER en crear, listar y eliminar. | Aprobado |
| H12-U08 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Fechas inválidas o ausentes | Validar DTO sin fechas, con formato no ISO y con día inexistente. | El DTO produce errores de validación que se traducen a 400. | class-validator encontró errores para los tres cuerpos inválidos. | Aprobado |
| H12-U09 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Inicio anterior a hoy | Enviar inicio 2026-11-15 con reloj fijado en 2026-11-16. | Responde 400 antes de iniciar la transacción. | BadRequestException; la transacción no fue invocada. | Aprobado |
| H12-U10 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Fin anterior al inicio | Enviar inicio 2026-11-22 y fin 2026-11-21. | Responde 400 antes de consultar o escribir en el repositorio. | BadRequestException; la transacción no fue invocada. | Aprobado |
| H12-U11 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Fecha fuera de horizonte | Enviar fecha 2027-02-14 con hoy fijado en 2026-11-16. | Responde 400 antes de iniciar la transacción. | BadRequestException; la transacción no fue invocada. | Aprobado |
| H12-U12 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Traslape con otro bloqueo | Simular bloqueo previo en el mismo periodo e intentar crear otro. | Responde 409 DATES_UNAVAILABLE y no crea el registro. | ConflictException 409; createAvailabilityBlock no fue llamado. | Aprobado |
| H12-U13 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Traslape con reserva PENDING | Simular reserva PENDING que ocupa el periodo e intentar bloquearlo. | Responde 409 DATES_UNAVAILABLE y no crea el registro. | ConflictException 409; createAvailabilityBlock no fue llamado. | Aprobado |
| H12-U14 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Traslape con reserva PAID | Simular reserva PAID que ocupa el periodo e intentar bloquearlo. | Responde 409 DATES_UNAVAILABLE y no crea el registro. | ConflictException 409; createAvailabilityBlock no fue llamado. | Aprobado |
| H12-U15 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Bien ajeno o inexistente al crear | Simular que el bien no pertenece al arrendador de sesión. | Responde 404 y no crea bloqueo. | NotFoundException 404; no se creó el bloqueo. | Aprobado |
| H12-U16 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Bien ajeno o inexistente al consultar | Simular que no se encuentra un bien propio y consultar su lista. | Responde 404 y no consulta los bloqueos. | NotFoundException 404; listAvailabilityBlocks no fue llamado. | Aprobado |
| H12-U17 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Bloqueo inexistente al eliminar | Simular que la consulta del bloqueo no encuentra resultado. | Responde 404 y no elimina registros. | NotFoundException 404; deleteAvailabilityBlock no fue llamado. | Aprobado |
| H12-U18 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Bloqueo de otro arrendador | Simular bloqueo existente cuyo bien no pertenece al usuario. | Responde 404 y conserva el bloqueo. | NotFoundException 404; deleteAvailabilityBlock no fue llamado. | Aprobado |
| H12-U19 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Sesión o rol no autorizado | Ejecutar RolesGuard como TENANT, ADMIN y sin usuario; ejecutar JwtAuthGuard sin token. | TENANT y ADMIN reciben 403; una solicitud sin sesión recibe 401. | RolesGuard rechazó roles y falta de usuario; JwtAuthGuard rechazó la solicitud sin token con 401. | Aprobado |
| H12-U20 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | UUID inválido | Pasar un ID inválido por ParseUUIDPipe para cada una de las tres rutas. | Cada ruta rechaza el ID con 400. | ParseUUIDPipe lanzó BadRequestException en las tres comprobaciones. | Aprobado |
| H12-U21 | Negativa | Módulo 3: Reservas y calendario de disponibilidad / H12: Bloqueo de fechas no disponibles | Conflicto de serialización | Simular error Prisma P2034 durante la transacción de creación. | Responde 409 DATES_UNAVAILABLE. | El servicio convirtió P2034 en ConflictException con code DATES_UNAVAILABLE. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H12.spec.ts` — Vitest reportó 1 archivo aprobado y 21 pruebas aprobadas.

## Módulo 9: Panel de reportes para el arrendador — H24: Ingresos totales (Unitarias)

### Casos positivos ejecutados

- **H24-U01:** El sistema suma los alquileres de reservas pagadas y finalizadas y devuelve los montos con dos decimales.
- **H24-U02:** El sistema suma el monto retenido de depósitos retenidos o parcialmente retenidos.
- **H24-U03:** El sistema filtra alquileres por fecha de pago y depósitos por fecha de decisión.
- **H24-U04:** El sistema limita el cálculo a propiedades del arrendador autenticado.
- **H24-U05:** El sistema muestra `0.00` en todos los montos cuando no hay ingresos.
- **H24-U06:** El sistema permite consultar el reporte al usuario autenticado con rol `OWNER`.

### Casos negativos ejecutados

- **H24-U07:** El sistema excluye reservas pendientes o canceladas y depósitos pendientes o devueltos.
- **H24-U08:** El sistema rechaza fechas ISO inválidas en `from` o `to` con error 400.
- **H24-U09:** El sistema rechaza una fecha `to` anterior a `from` con `400 VALIDATION_ERROR`.
- **H24-U10:** El sistema rechaza la consulta sin sesión con 401.
- **H24-U11:** El sistema deniega el reporte a `TENANT` con 403.
- **H24-U12:** El sistema deniega el reporte a `ADMIN` con 403.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H24-U01 | Positiva | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Suma de alquileres pagados y finalizados | Simular agregado de `rentalAmount` por 450.00 y consultar el servicio. | Devuelve alquileres y total como `450.00`, con los demás montos a `0.00`. | El servicio devolvió `rentalIncome: 450.00`, `totalIncome: 450.00` y formato de dos decimales. | Aprobado |
| H24-U02 | Positiva | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Suma del monto retenido | Simular agregado de `retainedAmount` por 75.50 y consultar el servicio. | Devuelve depósito retenido y total como `75.50`. | El servicio devolvió `retainedDepositIncome: 75.50` y `totalIncome: 75.50`. | Aprobado |
| H24-U03 | Positiva | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Filtros por fecha según tipo de ingreso | Consultar el repositorio con límites desde 2026-11-01 hasta 2026-11-30. | Prisma filtra pagos por `createdAt` y depósitos por `decidedAt`, incluyendo los límites. | Las dos agregaciones recibieron sus filtros de fecha correspondientes y los límites inclusivos. | Aprobado |
| H24-U04 | Positiva | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Propiedades del arrendador autenticado | Ejecutar las dos consultas con el ID del arrendador y revisar el filtro relacionado. | Ambas consultas filtran las reservas mediante `booking.property.ownerId` de la sesión. | Las consultas Prisma incluyeron el `ownerId` recibido en ambas relaciones de reserva y propiedad. | Aprobado |
| H24-U05 | Positiva | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Período sin ingresos | Simular agregados vacíos y consultar sin fechas. | Devuelve `0.00` para alquileres, depósitos retenidos y total; `from` y `to` son `null`. | El servicio devolvió los tres montos como `0.00` y ambos límites como `null`. | Aprobado |
| H24-U06 | Positiva | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Acceso del rol OWNER | Ejecutar `RolesGuard` con una sesión `OWNER` y metadata requerida `OWNER`. | El guard permite el acceso al reporte. | `RolesGuard` permitió la consulta del usuario `OWNER`. | Aprobado |
| H24-U07 | Negativa | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Exclusión de estados no elegibles | Inspeccionar agregaciones para pagos y depósitos. | Pagos solo consideran reservas `PAID`/`COMPLETED` y depósitos solo `RETAINED`/`PARTIALLY_RETAINED`. | Prisma recibió los estados admitidos y suma `rentalAmount` y `retainedAmount`, excluyendo los demás estados. | Aprobado |
| H24-U08 | Negativa | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Formato de fechas inválido | Validar `from` y `to` con texto inválido y fecha inexistente. | El DTO produce errores de validación que responden 400. | class-validator rechazó ambos valores para los dos parámetros. | Aprobado |
| H24-U09 | Negativa | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Rango de fechas invertido | Consultar con `from: 2026-11-20` y `to: 2026-11-01`. | Responde 400 con código `VALIDATION_ERROR`. | El servicio lanzó `BadRequestException` con `VALIDATION_ERROR`. | Aprobado |
| H24-U10 | Negativa | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Consulta sin sesión | Ejecutar `JwtAuthGuard` sin encabezado Bearer. | El guard rechaza la solicitud con 401. | Se lanzó `UnauthorizedException`. | Aprobado |
| H24-U11 | Negativa | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Rol TENANT no permitido | Ejecutar `RolesGuard` para `TENANT` en la ruta H24. | El guard rechaza el acceso con 403. | Se lanzó `ForbiddenException`. | Aprobado |
| H24-U12 | Negativa | Módulo 9: Panel de reportes para el arrendador / H24: Ingresos totales | Rol ADMIN no permitido | Ejecutar `RolesGuard` para `ADMIN` en la ruta H24. | El guard rechaza el acceso con 403. | Se lanzó `ForbiddenException`. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H24.spec.ts` — Vitest reportó 1 archivo aprobado y 12 pruebas aprobadas.

## Módulo 4: Pagos y depósitos de garantía — H13: Pago de alquiler con detalle del depósito (Unitarias)

### Casos positivos ejecutados

- **H13-U01:** El detalle de pago muestra el bien, el periodo, los días inclusivos, el alquiler, el depósito, el total y la hora límite con montos a dos decimales.
- **H13-U02:** Una tarjeta terminada en 4242 se procesa después de dos segundos, cambia la reserva a pagada, registra pago, depósito y movimiento, notifica al arrendador y devuelve el comprobante.
- **H13-U03:** El arrendatario de la reserva consulta sus movimientos con tipo, monto, motivo y fecha.
- **H13-U04:** El arrendador propietario consulta los movimientos de la reserva.
- **H13-U05:** Las rutas de resumen y pago requieren el rol TENANT.
- **H13-U18:** El repositorio ordena los movimientos del más reciente al más antiguo.

### Casos negativos ejecutados

- **H13-U06:** La tarjeta terminada en 0002 se rechaza con el mensaje indicado y no modifica la reserva ni crea registros.
- **H13-U07a:** El resumen no está disponible para una reserva cancelada.
- **H13-U07b:** El resumen no está disponible para una reserva pendiente vencida.
- **H13-U08a:** No se puede pagar una reserva cancelada.
- **H13-U08b:** No se puede pagar una reserva pendiente vencida.
- **H13-U09:** No se puede volver a pagar una reserva pagada.
- **H13-U10:** Una carrera de pago que encuentra la reserva ya pagada responde `ALREADY_PAID`.
- **H13-U11:** El arrendatario no puede pagar una reserva ajena.
- **H13-U12:** El arrendatario no puede consultar el resumen de una reserva ajena.
- **H13-U13:** Un tercero no puede consultar movimientos de una reserva ajena.
- **H13-U14:** No se puede pagar un bien que requiere verificación con un perfil no verificado.
- **H13-U15:** No se puede consultar el detalle de pago de un bien que requiere verificación con un perfil no verificado.
- **H13-U16:** El DTO rechaza un UUID requerido ausente o inválido.
- **H13-U17a:** El DTO rechaza los últimos dígitos vacíos.
- **H13-U17b:** El DTO rechaza menos de cuatro dígitos.
- **H13-U17c:** El DTO rechaza más de cuatro dígitos.
- **H13-U17d:** El DTO rechaza caracteres que no sean dígitos.
- **H13-U19:** OWNER y ADMIN reciben 403 y la solicitud sin sesión recibe 401.
- **H13-U20:** Un UUID inválido en el identificador del historial responde 400.

### Tabla de resultados

| ID de prueba | Tipo | Módulo / Historia | Descripción | Pasos ejecutados | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|---|
| H13-U01 | Positiva | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Resumen y desglose del pago | Consultar resumen para periodo inclusivo de tres días con precio diario 50.00 y depósito 100.00. | Devuelve alquiler 150.00, total 250.00, datos del bien y vencimiento. | El resumen incluyó tres días, los importes calculados con dos decimales y `expiresAt`. | Aprobado |
| H13-U02 | Positiva | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Pago aprobado y comprobante | Pagar con 4242, avanzar el reloj simulado dos segundos y revisar las operaciones transaccionales y notificación. | Reserva `PAID`; crea Payment, Deposit y movimiento; devuelve recibo y avisa al propietario. | Se confirmaron las escrituras en transacción, recibo con desglose y últimos cuatro dígitos, y notificación al owner del bien. | Aprobado |
| H13-U03 | Positiva | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Historial para el arrendatario | Consultar movimientos usando el ID del tenant relacionado y verificar los campos presentados. | Devuelve tipo, monto, motivo y fecha del movimiento. | La respuesta transformó el movimiento a `COBRO`, monto decimal de dos dígitos y fecha ISO. | Aprobado |
| H13-U04 | Positiva | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Historial para el arrendador | Consultar movimientos usando el ID del owner de la propiedad. | El arrendador relacionado obtiene el historial. | El servicio autorizó al owner y devolvió los movimientos recibidos. | Aprobado |
| H13-U05 | Positiva | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Rol permitido para resumen y pago | Revisar metadata de ambos handlers y ejecutar RolesGuard como TENANT. | Las rutas declaran TENANT y el guard permite ese rol. | Los dos handlers declararon `TENANT`; RolesGuard autorizó la sesión. | Aprobado |
| H13-U06 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Fondos insuficientes | Procesar tarjeta 0002 y revisar error y métodos de persistencia. | Responde 400 `INSUFFICIENT_FUNDS` con el mensaje exacto; no actualiza ni crea registros. | El servicio devolvió el error y no ejecutó transacción, pago, depósito ni movimiento. | Aprobado |
| H13-U07a | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Resumen de reserva cancelada | Consultar el resumen de una reserva `CANCELED`. | Responde 409 `BOOKING_NOT_PAYABLE`. | El servicio rechazó la reserva con estado 409. | Aprobado |
| H13-U07b | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Resumen de reserva vencida | Consultar el resumen de una reserva `PENDING` cuyo vencimiento ya pasó. | Responde 409 `BOOKING_NOT_PAYABLE`. | El servicio rechazó la reserva vencida con estado 409. | Aprobado |
| H13-U08a | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Pago de reserva cancelada | Intentar pagar una reserva `CANCELED` y revisar escrituras. | Responde 409 y no crea pago. | Se rechazó antes de abrir la transacción y no se creó Payment. | Aprobado |
| H13-U08b | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Pago de reserva vencida | Intentar pagar una reserva `PENDING` expirada y revisar escrituras. | Responde 409 y no crea pago. | Se rechazó antes de abrir la transacción y no se creó Payment. | Aprobado |
| H13-U09 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Reserva ya pagada | Pagar una reserva en estado `PAID`. | Responde 409 `ALREADY_PAID`. | El servicio rechazó el pago sin iniciar una nueva transacción. | Aprobado |
| H13-U10 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Doble pago concurrente | Simular conflicto Prisma P2002 y releer la reserva en estado `PAID`. | Convierte el conflicto en 409 `ALREADY_PAID`. | La respuesta del servicio incluyó el código `ALREADY_PAID`. | Aprobado |
| H13-U11 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Pago de reserva ajena | Intentar pagar con una sesión distinta al tenant de la reserva. | Responde 404 y no inicia la transacción. | El servicio lanzó NotFoundException antes de escribir. | Aprobado |
| H13-U12 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Resumen de reserva ajena | Consultar resumen con otro tenant autenticado. | Responde 404. | El servicio lanzó NotFoundException. | Aprobado |
| H13-U13 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Historial de reserva ajena | Consultar los movimientos como un tercero no relacionado. | Responde 404 y no consulta movimientos. | El servicio lanzó NotFoundException y `listTransactions` no fue llamado. | Aprobado |
| H13-U14 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Verificación requerida al pagar | Intentar pagar con perfil no verificado cuando `verifiedOnly` es true. | Responde 403 `VERIFICATION_REQUIRED` y no escribe. | El servicio lanzó ForbiddenException antes de abrir la transacción. | Aprobado |
| H13-U15 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Verificación requerida al consultar resumen | Consultar resumen con perfil no verificado cuando `verifiedOnly` es true. | Responde 403 `VERIFICATION_REQUIRED`. | El servicio respondió 403 con el código esperado. | Aprobado |
| H13-U16 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | UUID requerido inválido | Validar DTO sin `bookingId` y con valor que no es UUID. | class-validator rechaza ambos cuerpos para responder 400. | Se encontraron errores de validación en ambos DTOs. | Aprobado |
| H13-U17a | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Últimos dígitos vacíos | Validar `last4Digits` como cadena vacía. | El DTO rechaza la entrada con error 400. | class-validator reportó errores de validación. | Aprobado |
| H13-U17b | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Menos de cuatro dígitos | Validar `last4Digits` con dos dígitos. | El DTO rechaza la entrada con error 400. | class-validator reportó errores de validación. | Aprobado |
| H13-U17c | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Más de cuatro dígitos | Validar `last4Digits` con cinco dígitos. | El DTO rechaza la entrada con error 400. | class-validator reportó errores de validación. | Aprobado |
| H13-U17d | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Caracteres no numéricos | Validar `last4Digits` con una letra. | El DTO rechaza la entrada con error 400. | class-validator reportó errores de validación. | Aprobado |
| H13-U18 | Positiva | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Orden del historial | Inspeccionar los argumentos de la consulta Prisma del repositorio. | Ordena por fecha descendente y desempata por ID descendente. | Prisma recibió ambos criterios descendentes. | Aprobado |
| H13-U19 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | Sesión y roles no autorizados | Ejecutar RolesGuard como OWNER, ADMIN y sin usuario; ejecutar JwtAuthGuard sin token. | OWNER y ADMIN reciben 403; sin sesión recibe 401. | Los guards rechazaron los dos roles y la solicitud sin token con los estados esperados. | Aprobado |
| H13-U20 | Negativa | Módulo 4: Pagos y depósitos de garantía / H13: Pago de alquiler con detalle del depósito | UUID inválido en historial | Pasar texto que no es UUID por ParseUUIDPipe del parámetro. | Responde 400. | ParseUUIDPipe lanzó BadRequestException. | Aprobado |

Ejecución: `npm.cmd test -- test/unit/historia-H13.spec.ts` — Vitest reportó 1 archivo aprobado y 25 pruebas aprobadas.
