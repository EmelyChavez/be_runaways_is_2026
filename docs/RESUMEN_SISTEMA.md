# Resumen del sistema

## Módulo 0: Autenticación y perfil

Este módulo permite que cada persona cree y acceda a su cuenta y use el sistema según el rol que tiene activo. Desde su perfil puede consultar sus datos y cambiar entre arrendatario y arrendador cuando cumple las reglas; el sistema conserva la verificación, protege las operaciones y pausa sus bienes disponibles al volver a arrendatario.

- **H28 — Registro, inicio, renovación y cierre de sesión:** una persona crea una cuenta con su perfil asociado y el sistema siempre le asigna el rol de arrendatario. Puede iniciar sesión, renovar sus tokens y cerrar sesión; el backend entrega los tokens para que Next.js los gestione en una cookie HttpOnly. El sistema valida la contraseña, protege rutas según sesión y rol, limita intentos fallidos y evita revelar si falló el correo o la contraseña.
- **H29 — Consulta de perfil y cambio de rol entre arrendatario y arrendador:** el usuario consulta su nombre, correo, rol, verificación, documento con el número enmascarado y calificación correspondiente a su rol actual. Puede cambiar entre arrendatario y arrendador para ofrecer bienes o volver a reservar y pagar. El sistema bloquea el cambio si hay reservas pendientes o pagadas, depósitos pendientes de decisión o si ya tiene el rol solicitado; ADMIN no puede cambiarlo. Al volver a arrendatario, sus bienes disponibles quedan pausados.

## Módulo 1: Catálogo de propiedades/equipo

Este módulo reúne las publicaciones de bienes disponibles para alquilar. El arrendador administra sus propios bienes y el arrendatario consulta la información para decidir cuál reservar. Por ahora, estas funciones están disponibles mediante la API del backend.
- **H2 — Consultar el catálogo de bienes disponibles:** el arrendatario consulta las publicaciones que puede alquilar y obtiene la información necesaria para reconocer cada bien, incluida su imagen, ubicación, categoría y precio diario. El sistema presenta los bienes disponibles del más reciente al más antiguo, en páginas de 12, y excluye los pausados o eliminados. Si no hay publicaciones disponibles, la API devuelve una lista vacía; el acceso requiere una sesión con rol `TENANT`.
- **H3 — Ver detalle de un bien:** el arrendatario consulta las fotos, descripción, ubicación, categoría, precio, depósito y nombre del arrendador para decidir si desea alquilarlo. La API incluye la calificación promedio y la cantidad de reseñas, y solo devuelve el detalle de bienes disponibles; los bienes pausados, eliminados o inexistentes no se pueden consultar. Solo API por ahora; la presentación de «Sin depósito», «Sin calificaciones» y los mensajes y enlaces de la pantalla corresponde al frontend.
- **H4 — Ver y editar mis publicaciones:** el arrendador consulta sus bienes disponibles y pausados y puede actualizar sus datos e imágenes. Si una publicación tiene reservas pendientes o pagadas, puede editar los demás campos, pero el sistema bloquea los cambios de precio o depósito para no alterar las condiciones de esas reservas.
- **H5 — Pausar, reactivar o eliminar una publicación:** el arrendador puede pausar un bien para ocultarlo del catálogo y del detalle público, y reactivarlo para que vuelva a estar disponible. Si decide eliminarlo, el sistema lo marca como eliminado y conserva sus reseñas. Las reservas pendientes de pago o ya pagadas impiden pausar, reactivar o eliminar el bien.

## Módulo 2: Búsqueda y filtros

Este módulo ayuda al arrendatario a reducir el catálogo hasta encontrar bienes que se ajusten a su búsqueda. Las opciones se pueden combinar, así que cada criterio refina los resultados de los demás. Por ahora, la búsqueda está disponible mediante la API del backend.

- **H6 — Búsqueda de bienes por criterios:** el arrendatario puede buscar por texto y acotar los resultados por departamento y municipio, categoría o bienes sin depósito. El sistema combina los criterios enviados y muestra solo publicaciones disponibles; si ninguna coincide, devuelve una lista vacía.

- **H8 — Filtrar publicaciones por fechas disponibles:** el arrendatario puede indicar las fechas de inicio y fin del periodo en que necesita el bien. El sistema muestra solo las publicaciones sin reservas pagadas, reservas pendientes cuyo plazo de pago de 24 horas siga vigente ni fechas bloqueadas por el arrendador durante ese periodo; las reservas canceladas, finalizadas o pendientes vencidas no ocupan fechas.

## Módulo 3: Reservas y calendario de disponibilidad

Este módulo ayuda al arrendatario a consultar fechas disponibles y solicitar la reserva de un bien; el calendario y las reservas consideran los periodos ocupados, y las reservas pendientes liberan las fechas si vencen sin pago. El arrendador consulta las solicitudes de sus bienes y bloquea fechas en que no los ofrecerá. Por ahora, estas funciones están disponibles mediante la API del backend.

- **H9 — Consulta de disponibilidad de un bien:** el arrendatario consulta el calendario de 90 días de un bien antes de solicitar una reserva. El sistema marca como ocupados los días incluidos en reservas PENDIENTES o PAGADAS y en bloqueos del arrendador; las reservas CANCELADAS y FINALIZADAS no ocupan fechas. La respuesta solo indica qué fechas están ocupadas, sin revelar quién reservó; si el bien está pausado o eliminado, el sistema informa que ya no está disponible.

- **H10 — Reserva de un bien por un periodo:** el arrendatario elige un periodo y confirma la solicitud; el sistema calcula el subtotal usando el precio del bien y crea una reserva pendiente si las fechas siguen disponibles. La reserva ocupa el periodo durante 24 horas para que pueda pagarse; si vence sin pago, se cancela y libera las fechas. El arrendatario consulta sus propias reservas y el arrendador las solicitudes de sus bienes.

- **H12 — Bloqueo de fechas no disponibles:** el arrendador bloquea un periodo de su bien para que no pueda ser reservado y, después de confirmar, puede eliminar ese bloqueo. El sistema muestra los bloqueos vigentes ordenados por fecha y refleja esos días como ocupados en el calendario; no acepta fechas fuera del rango permitido ni periodos que se traslapen con otro bloqueo o con una reserva pendiente o pagada.

## Módulo 4: Pagos y depósitos de garantía

Este módulo permite al arrendatario completar el pago de una reserva y consultar los cobros asociados, mientras el arrendador administra la devolución o retención del depósito de garantía. Ambas partes pueden consultar los movimientos y el estado del depósito de sus reservas relacionadas.

- **H13 — Pago de alquiler con detalle del depósito:** antes de pagar, el arrendatario consulta el detalle del bien, el periodo, el alquiler, el depósito y el total. El pago simulado aprobado cambia la reserva a pagada, registra el desglose del cobro y el depósito, y devuelve un comprobante; la tarjeta terminada en 0002 se rechaza sin cambiar la reserva. El sistema impide cobrar reservas ajenas, vencidas, canceladas o ya pagadas y limita el historial de movimientos al arrendatario y al arrendador involucrados.

- **H14 — Devolución o retención del depósito de garantía:** cuando la reserva está finalizada, el arrendador propietario decide devolver el depósito o retener una parte o el total, indicando el motivo. El sistema registra la decisión y sus movimientos, notifica al arrendatario y mantiene visible cuánto se retuvo y cuánto se devolvió. Si no se decide dentro del plazo de siete días, el depósito se devuelve automáticamente.

## Módulo 5: Mensajería entre arrendador y arrendatario

Este módulo permite que el arrendatario inicie una conversación desde el detalle de un bien y que ambas partes coordinen sus dudas y detalles del alquiler dentro de un hilo privado. El sistema conserva los mensajes, muestra los pendientes de lectura y notifica al otro participante.

- **H15 — Preguntar dudas sobre el alquiler:** el arrendatario inicia o recupera el hilo asociado a un bien y puede enviar mensajes al arrendador propietario. El sistema limita cada hilo a sus participantes, registra la fecha y hora de los mensajes, actualiza los mensajes recibidos como leídos al abrir el hilo y notifica al otro participante cada vez que se envía un mensaje.

## Módulo 6: Reseñas y calificaciones

Este módulo permite que ambas partes compartan su experiencia después de completar una reserva: el arrendatario califica el bien y al arrendador, y el arrendador califica al arrendatario. Las calificaciones ayudan a generar confianza antes de alquilar.

- **H17 — Calificar experiencia sobre un bien y su arrendador:** después de que su reserva queda finalizada, el arrendatario puede calificar el bien y a su arrendador, y agregar un comentario. Tiene 14 días para hacerlo y solo puede enviar una calificación por reserva; el sistema actualiza los promedios que se muestran en el detalle del bien y el perfil del arrendador.
- **H18 — Calificar experiencia con arrendatario:** después de que finaliza una reserva de uno de sus bienes, el arrendador puede calificar al arrendatario y agregar un comentario. Tiene 14 días para hacerlo y solo puede calificar una vez cada reserva; el promedio del arrendatario se refleja en su perfil y en las reservas de los bienes del arrendador.

## Módulo 7: Verificación de identidad/documentos

Este módulo permite que el arrendatario envíe su documento para verificar la cuenta antes de poder pasar a arrendador o reservar. El sistema conserva el estado de revisión y permite volver a presentar el documento si fue rechazado; una vez verificada la cuenta, habilita la renta de cualquier bien. Por ahora, estas funciones están disponibles mediante la API del backend.

- **H19 — Enviar documento de identidad para verificación:** el tenant selecciona DUI o pasaporte e informa el número y el archivo de identidad. El sistema valida que los datos y el archivo cumplan los formatos admitidos y registra el trámite como pendiente. Mientras espera revisión o si la cuenta ya está verificada, no acepta otro envío; después de un rechazo, permite presentar un documento nuevo.

- **H20 — Aprobar o rechazar documentos de identidad:** el administrador consulta los documentos pendientes y revisa el archivo antes de decidir. Al aprobar, el sistema marca el documento como aprobado y la cuenta como verificada; al rechazar, guarda el motivo. Ambas decisiones registran cuándo se revisaron.Al aprobar o rechazar, el sistema también solicita una notificación para el usuario.

- **H21 — Rentar solo a usuarios verificados:** el arrendatario puede explorar el catálogo, consultar el detalle y revisar la disponibilidad aunque su cuenta todavía no esté verificada. El sistema muestra que todos los bienes requieren una cuenta verificada y bloquea la creación y el pago de una reserva hasta que el arrendatario complete la verificación. La regla es global y el arrendador no puede desactivarla.

## Módulo 8: Notificaciones

Este módulo centraliza la generación de avisos y permite que cada usuario consulte y organice su propia bandeja. Las notificaciones se guardan como no leídas, se pueden marcar individualmente o todas y el contador refleja las pendientes.

- **H22 — Centralizar la generación y despacho de notificaciones:** los módulos solicitan avisos mediante un servicio común, que valida los datos, selecciona la plantilla del evento y registra la notificación para su destinatario. La revisión administrativa de documentos ya utiliza este flujo: al aprobar, se notifica la verificación de la cuenta; al rechazar, se comunica el motivo.

- **H23 — Consultar y gestionar notificaciones:** el usuario autenticado consulta sus notificaciones ordenadas de la más reciente a la más antigua, junto con su estado, fecha y módulo de origen. Puede marcar una notificación o todas como leídas y consultar cuántas siguen pendientes.

## Módulo 9: Panel de reportes para el arrendador

Este módulo ayuda al arrendador a entender cómo se desempeñan sus publicaciones. Permite que los arrendadores consulten el desempeño de sus publicaciones (ingresos, ocupación y calificación) para tomar decisiones informadas sobre precios y disponibilidad.

- **H24 — Ingresos totales:** el arrendador consulta cuánto ha generado con sus publicaciones, separando alquileres pagados de depósitos retenidos. Puede limitar el reporte a un rango de fechas: el alquiler se cuenta según la fecha de pago y el depósito según la fecha de decisión. El sistema excluye reservas pendientes o canceladas y depósitos pendientes o devueltos, y muestra cero cuando no hay ingresos en el período.

- **H25 — Visualización de ingresos por bien publicado:** el arrendador consulta cada una de sus publicaciones junto con los ingresos que generó para identificar cuáles producen más ganancias. Puede ordenar los bienes de mayor a menor ingreso o al revés. El reporte solo incluye bienes propios y no cuenta reservas canceladas.

- **H26 — Visualización de calificación de los bienes:** el arrendador consulta sus bienes junto con el promedio y la cantidad de calificaciones recibidas. El sistema calcula esos valores desde las reseñas de los arrendatarios, por lo que una nueva calificación se refleja en el siguiente reporte; para un bien sin reseñas entrega valores vacíos para que el panel muestre «Sin calificaciones». Puede ordenar el listado por promedio ascendente o descendente, y el reporte no permite modificar ni eliminar las reseñas.

- **H27 — Visualización de la tasa de ocupación por bien:** el arrendador consulta cuántos días estuvo ocupado cada bien en el período elegido y el porcentaje correspondiente. El sistema cuenta únicamente los días de reservas pagadas o finalizadas, sin duplicar fechas; no considera reservas pendientes o canceladas ni bloqueos del arrendador. Si no se indica un período, usa los últimos 30 días incluyendo hoy, y permite ordenar y paginar los resultados.
