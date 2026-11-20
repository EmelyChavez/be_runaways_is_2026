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
        string email UK
        string password
        string role
        string name
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    profile {
        uuid id PK
        uuid user_id FK, UK
        boolean is_verified
    }

    identity_document {
        uuid id PK
        uuid profile_id FK
        string document_type
        string document_number
        string document_url
        string document_status
        datetime submitted_at
        string rejection_reason
        datetime reviewed_at
    }

    property {
        uuid id PK
        uuid owner_id FK
        string title
        string description
        string category
        string department
        string municipality
        string address
        decimal price_per_day
        decimal security_deposit
        string images
        string status
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
        string status
        datetime expires_at
        datetime created_at
        datetime updated_at
    }

    review {
        uuid id PK
        uuid booking_id FK
        uuid property_id FK
        uuid author_id FK
        uuid target_user_id FK
        string review_type
        int property_rating
        int user_rating
        string comment
        datetime created_at
    }

    payment {
        uuid id PK
        uuid booking_id FK, UK
        uuid payer_id FK
        string receipt_number UK
        decimal rental_amount
        decimal deposit_amount
        decimal total_amount
        string last4_digits
        datetime created_at
    }

    deposit {
        uuid id PK
        uuid booking_id FK, UK
        uuid decided_by_id FK
        decimal amount
        string state
        decimal retained_amount
        decimal returned_amount
        datetime decided_at
        datetime created_at
        datetime updated_at
    }

    transaction_history {
        uuid id PK
        uuid booking_id FK
        string type
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
        string content
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
        string status
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

| Tabla | Descripción | Campos importantes |
|---|---|---|
| `user` | Cuenta de una persona que usa el sistema. | `name`, `email`, `password`, `role`, `isActive` |
| `profile` | Perfil de verificación asociado a una cuenta. | `user_id`, `is_verified` |
| `identity_document` | Documento de identidad enviado para verificación. | `document_type`, `document_number`, `document_url` (Cloudinary), `document_status`, `rejection_reason`, `submitted_at`, `reviewed_at` |
| `property` | Bien publicado para alquiler. | `owner_id`, `title`, `category`, `department`, `municipality`, `price_per_day`, `security_deposit`, `images` (URLs de Cloudinary), `status` |
| `no_availability` | Período en que un bien no está disponible. | `property_id`, `start_date`, `end_date` |
| `booking` | Reserva de un bien hecha por un arrendatario. | `property_id`, `tenant_id`, `start_date`, `end_date`, `subtotal`, `status`, `expires_at` |
| `payment` | Pago asociado a una reserva. | `booking_id`, `receipt_number`, `rental_amount`, `deposit_amount`, `total_amount`, `last4_digits` |
| `deposit` | Depósito de garantía asociado a una reserva. | `booking_id`, `decided_by_id`, `amount`, `state`, `retained_amount`, `returned_amount`, `decided_at` |
| `transaction_history` | Movimiento financiero registrado para una reserva. | `booking_id`, `type`, `amount`, `reason`, `created_at` |
| `review` | Calificación escrita por una de las partes de una reserva. | `booking_id`, `author_id`, `target_user_id`, `review_type`, `property_rating`, `user_rating`, `comment` |
| `conversation` | Hilo de mensajes entre el arrendatario y el arrendador de un bien. | `property_id`, `tenant_id`, `owner_id`, `created_at`, `updated_at` |
| `message` | Mensaje enviado dentro de una conversación. | `conversation_id`, `sender_id`, `content`, `is_read`, `created_at` |
| `notification` | Aviso asociado a un usuario y a un evento del sistema. | `recipient_id`, `title`, `message`, `event_type`, `origin_module`, `optional_reference`, `status` |

