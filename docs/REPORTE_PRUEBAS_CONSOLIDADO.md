# Reporte consolidado de pruebas

## Resumen global

| Tipo | Ejecutadas | Aprobadas | Fallidas |
|---|---:|---:|---:|
| Unitarias | 104 | 104 | 0 |
| E2E | 0 | 0 | 0 |
| **Total** | **104** | **104** | **0** |


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
