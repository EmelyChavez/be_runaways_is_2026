# Forma de trabajo

**Tablero:** [Runaways](https://trello.com/b/9dh0CIMs/runaways)

## Ramas (Git Flow)

- `main`: versión publicada en producción. Recibe entregas desde ramas `release/*` y correcciones urgentes desde ramas `hotfix/*`.
- `develop`: rama de integración de historias terminadas y aprobadas.
- `feature/<ID>-<descripcion>`: rama de trabajo creada desde `develop`, una por historia. Ejemplo: `feature/H15-tenant-conversations`.
- Las correcciones de historias antes de publicar también se trabajan en su rama `feature/<ID>-<descripcion>` y se integran mediante PR a `develop`.
- `release/<version>`: se crea desde `develop` para preparar la entrega. En ella solo se permiten ajustes finales y correcciones menores. Se abre PR hacia `main`; al aprobarse, la release también se integra de vuelta a `develop`.
- `hotfix/<descripcion>`: se crea desde `main` para corregir un defecto de producción. La corrección se integra en `main` y en `develop`, y se publica aumentando la versión de parche.

## Commits

Cada commit empieza con el ID de la historia, seguido de dos puntos, un gitmoji y una descripción breve en inglés, usando verbo en infinitivo o presente de forma consistente.

```text
H<ID>: <gitmoji> <descripción breve>
```

Ejemplos:

- `H28: :sparkles: add role enum`
- `H15: :sparkles: implement messaging`
- `H17: :memo: update documentation and testing`

Los cambios que cubren más de una historia deben dividirse en commits separados cuando sea posible. No se deben incluir contraseñas, tokens ni otros secretos en el mensaje o en los archivos versionados.

## Pull Requests

1. Actualizar `develop` y crear una rama `feature/<ID>-<descripcion>` desde ella.
2. Implementar la historia, crear commits con el ID correspondiente y subir la rama al repositorio remoto.
3. Abrir un Pull Request desde la rama de trabajo hacia `develop`.
4. Usar un título que incluya el ID y el nombre de la historia. En la descripción, resumir el cambio, enlazar la tarjeta del tablero, indicar cómo se verificó y mencionar migraciones o documentación modificada.
5. Solicitar revisión a otro integrante del equipo. El autor del PR no debe aprobar su propio cambio.
6. Atender los comentarios y actualizar la rama. Antes de fusionar, deben pasar `npm run lint`, `npm run build` y `npm test`.
7. Fusionar el PR a `develop` cuando tenga aprobación y las verificaciones requeridas estén correctas.
8. Para publicar, seguir el proceso de rama `release/X.Y.Z`, PR aprobado hacia `main`, etiqueta `vX.Y.Z` y sincronización de la release de vuelta a `develop`, descrito en [06-despliegue.md](./06-despliegue.md).