# Modelo de datos
Diagrama relacional de Runaways.

## Diagrama entidad-relación

```mermaid
erDiagram
    user ||--|| profile : "tiene"
    profile ||--o{ identity_document : "envía"
    user ||--o{ notification : "recibe"
    user ||--o{ property : "publica"
    user ||--o{ booking : "reserva"
    user ||--o{ payment : "paga"
    user |o--o{ deposit : "decide"
    user ||--o{ review : "escribe"
    user ||--o{ review : "recibe"
    user ||--o{ message : "envía"
    user ||--o{ conversation : "como arrendatario"
    user ||--o{ conversation : "como arrendador"
    property ||--o{ booking : "recibe"
    property ||--o{ no_availability : "bloqueada por"
    property ||--o{ review : "reseñada en"
    property ||--o{ conversation : "origina"
    conversation ||--o{ message : "contiene"
    booking ||--|| payment : "pagada con"
    booking ||--o| deposit : "garantizada por"
    booking ||--o{ transaction_history : "registra"
    booking ||--o{ review : "genera"

    user {
        uuid id PK
        string email UK "Usado para iniciar sesión"
        string password "Hash"
        string role "ARRENDATARIO, ARRENDADOR o ADMIN"
        string name
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    profile {
        uuid id PK
        uuid user_id FK, UK "Relación 1 a 1 con user"
        boolean is_verified
    }

    identity_document {
        uuid id PK
        uuid profile_id FK
        string document_type "DUI o PASAPORTE"
        string document_number
        string document_url "Ruta interna en Cloudinary"
        string document_status "PENDIENTE, APROBADO o RECHAZADO"
        datetime submitted_at
        string rejection_reason
        datetime reviewed_at
    }

    property {
        uuid id PK
        uuid owner_id FK
        string title
        string description
        string category "PROPIEDAD o EQUIPO"
        string department
        string municipality
        string address
        decimal price_per_day
        decimal security_deposit
        string images "URLs de Firebase"
        string status "DISPONIBLE, PAUSADO o ELIMINADO"
        datetime created_at
        datetime updated_at
    }

    no_availability {
        uuid id PK
        uuid property_id FK
        date start_date
        date end_date
        datetime created_at
    }

    booking {
        uuid id PK
        uuid property_id FK
        uuid tenant_id FK
        date start_date
        date end_date
        decimal subtotal
        string status "PENDIENTE, PAGADA, FINALIZADA o CANCELADA"
        datetime expires_at "created_at + 24 horas"
        datetime created_at
        datetime updated_at
    }

    review {
        uuid id PK
        uuid booking_id FK
        uuid property_id FK
        uuid author_id FK
        uuid target_user_id FK
        string review_type "RENTER_TO_PROPERTY u OWNER_TO_RENTER"
        int property_rating "1 a 5"
        int user_rating "1 a 5"
        string comment "Máximo 200"
        datetime created_at
    }

    payment {
        uuid id PK
        uuid booking_id FK, UK "Un solo pago por reserva"
        uuid payer_id FK
        string receipt_number UK "REC- más 6 dígitos"
        decimal rental_amount
        decimal deposit_amount
        decimal total_amount
        string last4_digits
        datetime created_at
    }

    deposit {
        uuid id PK
        uuid booking_id FK, UK
        uuid decided_by_id FK "Nulo si fue automático"
        decimal amount
        string state "PENDIENTE, DEVUELTO, RETENIDO o RETENIDO_PARCIAL"
        decimal retained_amount
        decimal returned_amount
        datetime decided_at
        datetime created_at
        datetime updated_at
    }

    transaction_history {
        uuid id PK
        uuid booking_id FK
        string type "COBRO, DEVOLUCION o RETENCION"
        decimal amount
        string reason
        datetime created_at
    }

    conversation {
        uuid id PK
        uuid property_id FK
        uuid tenant_id FK
        uuid owner_id FK
        datetime created_at
        datetime updated_at
    }

    message {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        string content "1 a 500 caracteres"
        boolean is_read
        datetime created_at
    }

    notification {
        uuid id PK
        uuid recipient_id FK
        string title
        string message
        string event_type
        string origin_module
        uuid optional_reference
        string status "UNREAD o READ"
        datetime created_at
        datetime updated_at
    }

    classDef cuentas fill:#fdf4ff,stroke:#e879f9,color:#000
    classDef catalogo fill:#fff7ed,stroke:#fb923c,color:#000
    classDef reservas fill:#f0fdfa,stroke:#2dd4bf,color:#000
    classDef pagos fill:#f0fdf4,stroke:#4ade80,color:#000
    classDef comunicacion fill:#f5f3ff,stroke:#a78bfa,color:#000

    class user,profile,identity_document cuentas
    class property,no_availability catalogo
    class booking,review reservas
    class payment,deposit,transaction_history pagos
    class conversation,message,notification comunicacion
```

## Descripción de las tablas

| Tabla | Descripción |
|---|---|
| `user` | Credenciales y control de acceso de la cuenta: correo único, hash de la contraseña, rol (`ARRENDATARIO`, `ARRENDADOR` o `ADMIN`) y bandera `isActive`. Toda cuenta nueva inicia como `ARRENDATARIO`. |
| `profile` | Perfil asociado de forma 1 a 1 a cada `user`. Guarda si la cuenta está verificada (`is_verified`), dato que consultan las reservas y los pagos (H21). |
| `identity_document` | Documento de identidad enviado para verificación: tipo (DUI o pasaporte), número, ruta privada del archivo en Firebase Storage, estado de revisión, motivo de rechazo y fecha de revisión por un `ADMIN`. |
| `property` | Bien publicado por un arrendador: título, descripción, categoría, ubicación, precio por día, depósito de garantía, fotos y estado (`DISPONIBLE`, `PAUSADO` o `ELIMINADO`). El borrado es lógico. |
| `no_availability` | Bloqueos de fechas que un arrendador registra sobre su bien. Se eliminan físicamente y cuentan como días ocupados junto con las reservas `PENDIENTE` y `PAGADA`. |
| `booking` | Reservación de un bien por un arrendatario en un rango de fechas. Nace `PENDIENTE` y vence a las 24 horas (`expires_at`) si no se paga. Nunca se borra: se cancela. |
| `payment` | Pago simulado de una reserva. Solo existe uno por reserva (`booking_id` único). Separa el monto del alquiler, el del depósito y el total, y guarda únicamente los últimos 4 dígitos de la tarjeta. |
| `deposit` | Depósito de garantía de una reserva. Solo se crea si el depósito del bien es mayor a 0. Registra el estado (`PENDIENTE`, `DEVUELTO`, `RETENIDO` o `RETENIDO_PARCIAL`) y los montos retenido y devuelto. `decided_by_id` es nulo cuando la devolución fue automática. |
| `transaction_history` | Historial de movimientos financieros de una reserva (`COBRO`, `DEVOLUCION`, `RETENCION`). Los registros no se eliminan. |
| `review` | Reseña de una reserva finalizada. `RENTER_TO_PROPERTY` califica el bien y al arrendador; `OWNER_TO_RENTER` califica al arrendatario. Los promedios se calculan a partir de esta tabla y no se guardan. |
| `conversation` | Hilo de conversación entre un arrendatario y el arrendador de un bien. Solo esas dos partes pueden verlo. |
| `message` | Mensaje de un hilo, de 1 a 500 caracteres, con indicador de lectura. |
| `notification` | Aviso dirigido a un usuario, creado por el servicio común de notificaciones. Guarda el módulo de origen, el tipo de evento, una referencia opcional al registro relacionado y su estado (`UNREAD` o `READ`). |

