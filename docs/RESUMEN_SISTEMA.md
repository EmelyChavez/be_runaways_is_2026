# Resumen del sistema

## Módulo 2: Búsqueda y filtros

**1. Qué hace el módulo:**  
Permite al arrendatario consultar publicaciones disponibles mediante texto, ubicación y características. La API devuelve resultados paginados y la cantidad total que coincide.

**2. Pantallas involucradas y qué elementos principales tiene cada una:**  
Pendiente de UI / Solo API por ahora. La interfaz de búsqueda y el mensaje «No se encontraron resultados» corresponden al frontend.

**3. Roles y permisos:**  
Arrendatario (`TENANT`): consulta el catálogo con sesión. Arrendador (`OWNER`) y administrador (`ADMIN`): no pueden consultar este endpoint; el catálogo está restringido a `TENANT`.

**4. Reglas de negocio y casos borde:**  
`GET /api/v1/properties` pagina a 12 resultados, ordenados del más reciente al más antiguo. Solo incluye bienes `AVAILABLE`; texto y filtros se combinan. El texto busca sin distinguir mayúsculas ni tildes en título, descripción y ubicación. Departamento y municipio comparan el valor completo sin distinguir mayúsculas; municipio requiere departamento. Categoría acepta `PROPERTY` o `EQUIPMENT`; `noDeposit=true` exige depósito igual a cero. Sin coincidencias, la API responde `200` con `data: []` y `total: 0`; el texto debe tener entre 2 y 100 caracteres.

**5. Dependencias con otros módulos:**  
Lee `Property` y sus campos de estado, categoría, departamento, municipio, título, descripción, dirección, depósito y fecha de creación. Usa la sesión JWT y el rol del módulo de autenticación. El endpoint de detalle del catálogo también consulta reseñas y datos del arrendador.

**6. Fichas rápidas por historia:**  
- **H6 — Búsqueda de bienes por criterios:** permite encontrar publicaciones combinando texto y filtros de departamento/municipio, categoría y ausencia de depósito.
- **Endpoint/pantalla:** `GET /api/v1/properties` (solo API por ahora; UI pendiente).
- **Validación crítica:** cada filtro debe aplicarse junto con los demás y excluir bienes `PAUSED` o `DELETED`; sin coincidencias devuelve `data: []`, `total: 0`.
