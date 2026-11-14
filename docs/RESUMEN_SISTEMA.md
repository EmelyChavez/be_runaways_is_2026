# Resumen del sistema

## Módulo 1: Catálogo de propiedades/equipo

Este módulo reúne las publicaciones de bienes disponibles para alquilar. El arrendador administra sus propios bienes y el arrendatario consulta la información para decidir cuál reservar. Por ahora, estas funciones están disponibles mediante la API del backend.

- **H5 — Pausar, reactivar o eliminar una publicación:** el arrendador puede pausar un bien para ocultarlo del catálogo y del detalle público, y reactivarlo para que vuelva a estar disponible. Si decide eliminarlo, el sistema lo marca como eliminado y conserva sus reseñas. Las reservas pendientes de pago o ya pagadas impiden pausar, reactivar o eliminar el bien.

## Módulo 2: Búsqueda y filtros

Este módulo ayuda al arrendatario a reducir el catálogo hasta encontrar bienes que se ajusten a su búsqueda. Las opciones se pueden combinar, así que cada criterio refina los resultados de los demás. Por ahora, la búsqueda está disponible mediante la API del backend.

- **H6 — Búsqueda de bienes por criterios:** el arrendatario puede buscar por texto y acotar los resultados por departamento y municipio, categoría o bienes sin depósito. El sistema combina los criterios enviados y muestra solo publicaciones disponibles; si ninguna coincide, devuelve una lista vacía.
