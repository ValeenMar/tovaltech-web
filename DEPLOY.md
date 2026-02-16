# 🚀 Deploy Rápido - TovalTech v2.0.3

## ✅ Fixes Aplicados en Esta Versión

1. **Límite de productos**: 1000 → 5000 (ahora carga todos los ~2550 productos)
2. **Provider NewBytes**: Normalización de campos `provider`/`providerId`
3. **Fuentes CORS**: Reemplazado Clash Display por Manrope (Google Fonts)
4. **Fuentes 404**: Configuración correcta de Google Fonts

---

## 📦 Pasos de Deploy

### 1. Backup del proyecto actual

```bash
# En tu directorio del proyecto
git add .
git commit -m "Backup antes de actualización v2.0.3"
```

### 2. Aplicar la actualización

```bash
# Descomprimir tovaltech-refactored-FINAL-v3.zip
# Copiar TODOS los archivos excepto /api (el backend no cambia)

# Estructura a reemplazar:
- /src/
- /assets/
- index.html
- package.json
- .gitignore
- README.md
- CHANGELOG.md
```

### 3. Push a GitHub

```bash
git add .
git commit -m "Update to v2.0.3: fix product limit + provider normalization"
git push origin main
```

### 4. Verificar Azure Static Web Apps

- Azure redeploya automáticamente en ~2-3 minutos
- Ir a: https://portal.azure.com → Static Web Apps → Ver deployment status

---

## 🔧 Troubleshooting Post-Deploy

### Problema: Aún veo 1000 productos

**Solución**: Hard refresh del navegador

- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

### Problema: Errores 404 en fuentes (.woff2)

**Causa**: Cache del navegador guardando CSS viejo

**Solución 1** - Hard refresh:
1. `Ctrl + Shift + R` (o `Cmd + Shift + R`)
2. Recargar página varias veces

**Solución 2** - Clear storage:
1. Abrir DevTools (`F12`)
2. Application → Storage → Clear site data
3. Cerrar y reabrir navegador

**Solución 3** - Modo incógnito:
1. Abrir en ventana incógnita (`Ctrl + Shift + N`)
2. Si funciona → el problema es cache
3. Volver a hacer clear storage en ventana normal

### Problema: Solo veo productos de ELIT, faltan NewBytes

**Verificación**: Abrir consola y ejecutar:

```javascript
fetch('/api/getProducts?limit=5000')
  .then(r => r.json())
  .then(data => {
    const providers = [...new Set(data.items.map(p => p.providerId))];
    console.log('Proveedores:', providers);
    console.log('ELIT:', data.items.filter(p => p.providerId === 'elit').length);
    console.log('NewBytes:', data.items.filter(p => p.providerId === 'newbytes').length);
    console.log('Total:', data.items.length);
  });
```

**Resultado esperado**:
```
Proveedores: ['elit', 'newbytes']
ELIT: 1128
NewBytes: 1422
Total: 2550
```

Si no ves NewBytes → problema en backend (Azure Table Storage).
Si ves NewBytes en consola pero no en UI → hacer hard refresh.

---

## 📊 Verificación Post-Deploy

### ✅ Checklist

- [ ] Página home carga correctamente
- [ ] Tienda muestra >2000 productos
- [ ] Filtros funcionan sin scroll horizontal
- [ ] Se ven productos de ELIT y NewBytes
- [ ] No hay errores 404 en consola (fuentes)
- [ ] No hay errores CORS en consola
- [ ] Theme toggle funciona (dark/light)
- [ ] Botón "Agregar al carrito" funciona
- [ ] Mobile responsive OK

### 🎯 Métricas Esperadas

**Home**:
- 6-8 productos destacados
- 6 categorías clickeables
- 16 marcas en marquee
- 3 bloques "Qué hacemos"

**Tienda**:
- **~2550 productos totales** ← IMPORTANTE
- Filtros colapsables en sidebar
- Pills de precio predefinidas
- Toggle USD/ARS
- Grid responsive

**Catálogo (Admin)**:
- Todos los productos
- Filtro por proveedor (ELIT/NewBytes)
- Control de margen %
- Acciones editar/eliminar

---

## 🆘 Contacto de Soporte

Si después de seguir todos los pasos siguen habiendo problemas:

1. Tomar screenshots de:
   - Consola (errores en rojo)
   - Network tab (requests fallidos)
   - Página con problema visible

2. Revisar logs de Azure Functions:
   - Portal Azure → Function App → Monitor → Logs

3. Verificar Azure Table Storage:
   - Portal Azure → Storage Account → Tables → Products
   - Verificar que haya ~2550 registros

---

## 📝 Notas Técnicas

### Backend (no modificado)

El backend sigue igual. Los únicos cambios son en el **frontend**:

- `src/pages/tienda.js` - límite 5000
- `src/pages/catalogo.js` - normalización provider
- `src/components/*` - fixes de mapping
- `src/utils/dataHelpers.js` - helpers mejorados
- `src/styles/*` - fuentes desde Google Fonts

### Archivos Críticos

No borrar ni modificar:
- `/api/*` - Backend Azure Functions
- `local.settings.json` - Config local
- `staticwebapp.config.json` - Config Azure

### Performance

Con 2550 productos:
- Carga inicial: ~2-3s
- Filtrado: instantáneo (client-side)
- Imágenes: lazy loading
- Cache: 15min para FX y CSV de ELIT

---

**Versión**: 2.0.3  
**Fecha**: 16 Febrero 2026  
**Estado**: ✅ Ready to deploy
