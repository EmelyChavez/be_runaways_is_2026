# Resumen del sistema

## Módulo 1: Catálogo de propiedades/equipo

Este módulo reúne las publicaciones de bienes disponibles para alquilar. El arrendador administra sus propios bienes y el arrendatario consulta la información para decidir cuál reservar. Por ahora, estas funciones están disponibles mediante la API del backend.

- **H5 — Pausar, reactivar o eliminar una publicación:** el arrendador puede pausar un bien para ocultarlo del catálogo y del detalle público, y reactivarlo para que vuelva a estar disponible. Si decide eliminarlo, el sistema lo marca como eliminado y conserva sus reseñas. Las reservas pendientes de pago o ya pagadas impiden pausar, reactivar o eliminar el bien.

## Módulo 2: Búsqueda y filtros

Este módulo ayuda al arrendatario a reducir el catálogo hasta encontrar bienes que se ajusten a su búsqueda. Las opciones se pueden combinar, así que cada criterio refina los resultados de los demás. Por ahora, la búsqueda está disponible mediante la API del backend.

- **H6 — Búsqueda de bienes por criterios:** el arrendatario puede buscar por texto y acotar los resultados por departamento y municipio, categoría o bienes sin depósito. El sistema combina los criterios enviados y muestra solo publicaciones disponibles; si ninguna coincide, devuelve una lista vacía.

## Módulo 7: Verificación de identidad/documentos

Este módulo permite que el arrendatario envíe su documento para verificar la cuenta antes de poder pasar a arrendador o reservar. El sistema conserva el estado de revisión y permite volver a presentar el documento si fue rechazado. Por ahora, estas funciones están disponibles mediante la API del backend.

- **H19 — Enviar documento de identidad para verificación:** el tenant selecciona DUI o pasaporte e informa el número y el archivo de identidad. El sistema valida que los datos y el archivo cumplan los formatos admitidos y registra el trámite como pendiente. Mientras espera revisión o si la cuenta ya está verificada, no acepta otro envío; después de un rechazo, permite presentar un documento nuevo.
