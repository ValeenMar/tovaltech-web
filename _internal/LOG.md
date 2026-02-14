# TovalTech - Log interno

## Regla (obligatoria)
- Este log vive en: `/_internal/LOG.md`.
- Cada vez que hagamos un cambio en el repo, agregá una entrada nueva arriba (debajo de “Últimas entradas”).
- Cada entrada debe incluir: **qué se cambió**, **por qué**, **archivos tocados**, **pasos para verificar**, y **cómo revertir**.
- Formato recomendado: el mismo que ya uso en las entradas de este archivo.

---

## Últimas entradas

### 2026-02-14 - Arreglo de API (ELIT/Providers/Products) y diagnóstico
**Problema**
- La web caía a **MOCK** (no aparecía ELIT) porque el llamado a `/api/getProviders` y/o `/api/getProducts` fallaba.

**Causa raíz**
- `api/functions/providersElitImport.js` tenía código suelto al final del archivo (fuera de cualquier función) que referenciaba variables inexistentes. Eso puede romper la carga del runtime de Functions.

**Cambios**
- Se eliminó el código suelto al final de `providersElitImport.js`.
- Se agregó soporte opcional de `imageUrl` dentro del import de ELIT.
- Se creó endpoint de salud: `/api/health` para validar variables de entorno y acceso a tablas.
- Se mejoró el reporting de errores en `/api/getProviders` y `/api/getProducts` (devuelven `error` real).
- Se mejoró el front para mostrar el motivo cuando cae a MOCK.

**Archivos tocados**
- `api/functions/providersElitImport.js`
- `api/functions/health.js` (nuevo)
- `api/index.js`
- `api/functions/getProviders.js`
- `api/functions/getProducts.js`
- `src/pages/catalogo.js`
- `src/pages/proveedores.js`

**Verificación (pasos exactos)**
1) Abrir en el browser: `/api/health`
   - Debe dar `ok: true`.
   - Debe marcar `tables.products/providers/chat = true`.
2) Abrir: `/api/getProviders`
   - Debe devolver `ok: true` y una lista que incluya `elit`.
3) Abrir: `/catalogo`
   - Debe mostrar `Datos: API` y el selector de proveedores con `ELIT`.
   - Debe mostrar productos si hay datos en la tabla `Products`.

**Revertir**
- Revertir commit que introduce estos cambios o restaurar versiones previas de los archivos listados.

---

## Checklist rápido de salud (cada vez que “no aparece ELIT”)
1) `/api/health`
2) `/api/getProviders`
3) `/api/getProducts?provider=elit&limit=5`
4) Ver consola del browser en `/catalogo` (si cae a MOCK ahora debería mostrar el motivo).

## Notas de variables de entorno (Azure Static Web Apps)
- Requeridas (API):
  - `STORAGE_CONNECTION_STRING`
  - `CHAT_TABLE_NAME` (si no, usa `chatlog`)
  - `PRODUCTS_TABLE_NAME` (si no, usa `Products`)
  - `PROVIDERS_TABLE_NAME` (si no, usa `Providers`)
- Para import de ELIT:
  - `ELIT_USER_ID`
  - `ELIT_TOKEN`
- Para login:
  - `APP_PASSWORD`
