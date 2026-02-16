# CHANGELOG - TovalTech Refactor

## v2.0.2 - Fix CORS de Google Fonts (16/02/2026)

### 🐛 Bug Fix

**Problema**: Error de CORS al cargar la fuente Clash Display desde Fontshare.

```
Access-Control-Allow-Origin header not matching origin
https://api.fontshare.com/v2/css?f[]=clash-display@400,700
```

**Solución**: Reemplazar Clash Display por **Manrope** (Google Fonts).

**Cambios**:
- ✅ Removido import de Fontshare que causaba CORS
- ✅ Agregado Manrope a Google Fonts import
- ✅ Reemplazadas todas las referencias en CSS (global.css, home.css, store.css)

Manrope es una fuente geométrica moderna muy similar a Clash Display, pero sin problemas de CORS.

---

## v2.0.1 - Fix NewBytes Provider (16/02/2026)

### 🐛 Bug Fixes

**Problema**: Solo se mostraban productos de ELIT, faltaban los de NewBytes.

**Causa**: El backend usa el campo `providerId` pero el frontend estaba buscando `provider` en algunos lugares, causando que se descartaran productos de NewBytes.

**Fixes aplicados**:

1. **dataHelpers.js** - `enrichProduct()`
   - Ahora normaliza `provider` a partir de `providerId` o `provider`
   - Línea agregada: `provider: p.providerId || p.provider || null`

2. **ProductCard.js** - Mostrar proveedor
   - Ahora busca tanto `product.provider` como `product.providerId`
   - Fix: `${esc(product.provider || product.providerId)}`

3. **catalogo.js** - Filtro de proveedor
   - El filtro ahora verifica ambos campos
   - Fix: `const prov = (p.provider || p.providerId || '').toLowerCase()`

4. **catalogo.js** - Extracción de proveedores únicos
   - Al renderizar sidebar, ahora extrae de ambos campos
   - Fix: `allProducts.map(p => p.provider || p.providerId)`

### ✅ Verificación

Para confirmar que funciona, ejecutar en consola:

```javascript
fetch('/api/getProducts?limit=2000')
  .then(r => r.json())
  .then(data => {
    const providers = [...new Set(data.items.map(p => p.providerId))];
    console.log('Proveedores:', providers);
    console.log('ELIT:', data.items.filter(p => p.providerId === 'elit').length);
    console.log('NewBytes:', data.items.filter(p => p.providerId === 'newbytes').length);
  });
```

Debería mostrar:
- `Proveedores: ['newbytes', 'elit']`
- `ELIT: 1130` (aprox)
- `NewBytes: 864` (aprox)

### 📦 Deploy

1. Descomprimir `tovaltech-refactored-v2.zip`
2. Reemplazar archivos en tu repo
3. Push a GitHub
4. Azure Static Web Apps se redeploya automáticamente

---

## v2.0.0 - Refactor Completo (16/02/2026)

Ver README.md para detalles completos del refactor inicial.
