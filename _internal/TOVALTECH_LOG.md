# TovalTech — Log + Instrucciones (archivo único)

**Ubicación de este archivo:** `_log/TOVALTECH_LOG.md`

Este archivo es:
- **Guía operativa** (qué tocar y cómo verificar).
- **Bitácora** (qué se cambió y cuándo).

---

## Flujo local estándar (push rápido)

En la carpeta del repo (donde está `index.html`):

```bash
git add -A
git commit -m "chore: update"
git push
```

Verificación mínima después del push:
- Abrir la web y entrar a **Productos**.
- Ver que el contador de items suba (no quede clavado en 100 / 1000).
- Abrir consola (F12) y confirmar que no hay 500 en `/api/getProducts`.

---

## ELIT — Imágenes + IVA (CSV)

### Qué pasa
- El endpoint JSON de ELIT **no trae imágenes**.
- El endpoint CSV de ELIT **sí trae** `imagen`, `miniatura` e `iva`.

### Import (desde la web / API)
Endpoint:
- `/api/providersElitImport?source=csv&max=5000&skip=0&password=TU_PASSWORD`

Notas:
- `max`: cuántos productos importar en esta corrida (default 5000).
- `skip`: desde qué fila del CSV empezar (para continuar si hacés más de una corrida).

Respuesta:
- Devuelve `imported`, `nextSkip` y `totalCsvRows`.

**Verificación**
- `/api/getProducts?provider=elit&limit=20000`
  - Debe devolver items con `imageUrl/thumbUrl` y `ivaRate` (cuando ya importaste CSV).

---

## Catálogo — IVA y ARS (UI)

- En Cards, abajo del precio base se muestra: **“Con IVA X%: ...”**.
- Al tocar un producto se abre un modal con:
  - Base
  - IVA
  - Total con IVA
  - Total en ARS

### FX USD→ARS
Arriba, en Catálogo, hay un input:
- `FX USD→ARS (opcional)`

Se guarda en `localStorage` (solo tu navegador).
- Si no lo configuras, el modal te lo indica y el ARS queda en “-”.

---

## Checklist rápido cuando algo “no se ve”
1) Hard refresh: `Ctrl + Shift + R`.
2) Confirmar que estás en la URL deploy (no local).
3) Probar API directo:
   - `/api/getProducts?provider=elit&limit=20000`
4) Si faltan imágenes/IVA:
   - correr import CSV:
     - `/api/providersElitImport?source=csv&max=5000&skip=0&password=TU_PASSWORD`

---

## Bitácora (append-only)

### 2026-02-14
- getProducts: se eliminó `$top=limit` (Azure Tables falla si limit > 1000) y se corta manualmente.
- providersElitImport: se agregó modo CSV (`source=csv`) para traer **imagen/miniatura/IVA**.
- Catálogo (UI): se agregó línea “Con IVA …” y modal con total ARS usando FX configurable.
