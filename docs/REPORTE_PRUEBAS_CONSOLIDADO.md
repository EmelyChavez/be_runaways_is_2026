# Reporte consolidado de pruebas

## Resumen global

| Tipo | Ejecutadas | Aprobadas | Fallidas |
|---|---:|---:|---:|
| Unitarias | 38 | 38 | 0 |
| E2E | 0 | 0 | 0 |
| **Total** | **38** | **38** | **0** |


## Módulo 1: Catálogo de propiedades/equipo — H5: Pausar, reactivar o eliminar una publicación

### Casos de prueba ejecutados

1. **H5-U01 — Pausar publicación AVAILABLE:** actualizar a PAUSED y devolver id, status y statusChangedAt.
2. **H5-U02 — Reactivar publicación PAUSED:** actualizar a AVAILABLE y devolver la fecha de cambio.
3. **H5-U03 — Eliminación lógica:** marcar como DELETED y conservar reseñas relacionadas.
4. **H5-U04 — Rol requerido OWNER:** verificar OWNER en ambos endpoints.
5. **H5-U05 — Arrendador autorizado:** verificar acceso del OWNER mediante RolesGuard.
6. **H5-U06 — Visibilidad:** verificar filtros de catálogo, detalle público y Mis publicaciones.
7. **H5-U07 — Estado destino inválido:** rechazar DELETED como estado destino.
8. **H5-U08 — Bien ajeno o inexistente al cambiar estado:** responder 404 sin actualizar.
9. **H5-U09 — Bien ajeno o inexistente al eliminar:** responder 404 sin eliminar.
10. **H5-U10 — Reserva PENDING:** bloquear cambio de estado y eliminación con 409 y el mensaje acordado.
11. **H5-U11 — Reserva PAID:** bloquear cambio de estado y eliminación con 409 y el mensaje acordado.
12. **H5-U12 — Bien DELETED:** rechazar el cambio de estado con 409.
13. **H5-U13 — Eliminación repetida:** rechazar con 409 un bien ya DELETED.
14. **H5-U14 — Sin sesión:** responder 401.
15. **H5-U15 — Rol TENANT:** responder 403.
16. **H5-U16 — Rol ADMIN:** responder 403.
17. **H5-U17 — Sin usuario autenticado:** responder 401.
18. **H5-U18 — UUID inválido:** responder 400 en ambas rutas.
19. **H5-U19 — Estados de reservas activas:** verificar que el conteo incluya PENDING y PAID.

### Resultados de ejecución

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

### Casos positivos

1. **H6-CA01 — Búsqueda por texto:** enviar un q válido. Esperar los resultados y el total que devuelve el repositorio.
2. **H6-CA02 — Búsqueda por ubicación:** enviar departamento y municipio. Esperar resultados que coincidan con ambos criterios.
3. **H6-CA03 — Filtro por categoría:** enviar PROPERTY o EQUIPMENT. Esperar que solo se incluyan bienes de esa categoría.
4. **H6-CA04 — Filtro “Sin depósito”:** enviar noDeposit=true. Esperar que se aplique el filtro de depósito igual a cero.
5. **H6-CA05 — Combinación de criterios:** enviar texto, ubicación, categoría y noDeposit=true. Verificar que se combinen todos los filtros y que los resultados cumplan cada uno.
6. **H6-CA06 — Actualizar búsqueda al modificar filtros:** invocar el servicio con una combinación y luego con otra. Esperar resultados y totales correspondientes a cada consulta.
7. **H6-CA07 — Actualizar búsqueda al quitar un filtro:** invocar con varios filtros y luego omitir uno. Esperar que la segunda consulta use los filtros restantes y su propio total.
8. **H6-CA08 — Sin coincidencias:** simular que el repositorio no encuentra publicaciones. Esperar data: [] y total: 0.
9. **H6-CA09 — Solo publicaciones disponibles:** verificar que el servicio incluya AVAILABLE en todas las consultas.

### Casos negativos

1. **H6-CA10 — Municipio sin departamento:** esperar 400 VALIDATION_ERROR y que no se consulte el repositorio.
2. **H6-CA11 — Texto demasiado corto o largo:** enviar menos de 2 o más de 100 caracteres. Esperar rechazo de validación.
3. **H6-CA12 — Categoría inválida:** enviar un valor distinto de PROPERTY o EQUIPMENT. Esperar rechazo de validación.
4. **H6-CA13 — Valor inválido para “Sin depósito”:** enviar noDeposit distinto de true o false. Esperar rechazo de validación.
5. **H6-CA14 — Rol no autorizado:** consultar el catálogo como OWNER o ADMIN. Esperar 403.
6. **H6-CA15 — Sin sesión:** consultar el catálogo sin autenticación. Esperar 401.
7. **H6-CA16 — Publicación no disponible:** incluir registros PAUSED y DELETED en los datos simulados y verificar que la consulta solo solicite AVAILABLE.

### Resultados de ejecución

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
