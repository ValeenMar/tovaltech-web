# TovalTech - Internal Log (único archivo)

Reglas:
- Cada vez que ChatGPT te dé cambios, pegás el bloque "Entrada de log" al final de este archivo.
- No se reescribe el pasado. Si algo quedó mal, se agrega una nueva entrada corrigiendo.
- Cada entrada debe tener: fecha, objetivo, cambios exactos (archivos), cómo verificar, y próximos pasos.

---

## 2026-02-14 04:04 UTC - Fix API + preparar soporte de imágenes (ELIT)

Objetivo:
- Preparar el sistema para mostrar imágenes si ELIT trae URLs.
- Normalizar moneda para que no aparezca "2" en el catálogo.

Cambios (archivos):
- `api/functions/providersElitImport.js`
  - Agregado `pickImageUrl()` para guardar `imageUrl` en la tabla `Products`.
  - Agregado `normalizeCurrency()` para convertir valores numéricos (ej: "2") a ISO ("ARS").
  - Limpieza del archivo (sin código suelto fuera del handler).
- `api/functions/getProducts.js`
  - Normaliza `currency` a ISO con `normalizeCurrency()`.
- `src/components/cards.js`
  - Siempre renderiza placeholder y, si hay imagen, muestra `<img>` encima.
  - Si la imagen falla, se elimina y queda el placeholder.
- `src/styles/global.css`
  - `.pMedia` pasó a `position:relative` y `.pImg/.pPh` a overlay absoluto.

Cómo verificar:
1) Debug de campos reales de ELIT:
   - Abrir: `/api/providersElitImport?debug=1&limit=10`
   - Ver si en `keys` o en `sample.resultado` existe algún campo con URL de imagen.
2) Import completo:
   - Abrir: `/api/providersElitImport?all=1&limit=100&offset=1`
3) Validar API:
   - Abrir: `/api/getProducts?provider=elit&limit=200`
   - Confirmar que `currency` sea "ARS"/"USD" (no números).
   - Confirmar que `image` o `imageUrl` no sea null si ELIT trae imágenes.
4) Validar UI:
   - Ir a `/catalogo`
   - Si hay URLs, deben aparecer imágenes en cards.

Próximos pasos:
- Si ELIT NO trae imágenes: definir estrategia (manual mapping, Blob Storage propio, o dejar placeholders).
- Implementar paginación real (cursor) para no cargar miles en una sola respuesta.

---

### Entrada de log (plantilla para copiar/pegar)

## AAAA-MM-DD HH:MM UTC - Título

Objetivo:

Cambios (archivos):

Cómo verificar:

Notas / Próximos pasos:
