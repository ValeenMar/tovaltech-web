# 🎯 Plan de Mejoras TovalTech - Febrero 2025

## 🔴 URGENTE (Esta semana)

### 1. ✅ Error 403 en Settings [RESUELTO]
**Status:** Código listo - Falta ejecutar script
**Archivos:**
- ✅ `api/scripts/initAdminUsers.js` - Script para inicializar usuarios
- ✅ `api/functions/login.js` - Mejorado para validar contra Users table
- ✅ `SOLUCION_403.md` - Guía de implementación

**Acción:** Correr `node api/scripts/initAdminUsers.js`

---

### 2. 🔍 Límite de 1000 items en Catálogo
**Problema actual:**
- API ELIT trae hasta 1000 items max
- Import CSV trae 1000 pero en la página solo se ven 100

**Causa probable:**
- Filtrado o límite de rendering en el frontend
- Falta paginación real

**Solución:**
- [ ] Revisar código de catalogo.js (línea que limita a 100)
- [ ] Implementar paginación virtual (solo renderizar lo visible)
- [ ] Agregar scroll infinito o load more
- [ ] Mostrar contador real de productos cargados

**Archivos a revisar:** `src/pages/catalogo.js`

---

### 3. 💰 Página de Venta al Público (margen 20-30%)
**Requerimiento:**
- Mostrar productos con margen de ganancia
- Precio en ARS con FX configurable (ej: 1420)
- Permitir al cliente final ver precios públicos

**Plan:**
- [ ] Nueva página `/tienda` o `/productos-publicos`
- [ ] Input para configurar margen (20-30%)
- [ ] Usar mismo FX USD→ARS que catálogo
- [ ] Cards con:
  - Precio base (oculto)
  - Precio con margen + IVA
  - Total en ARS
  - Botón "Consultar" o "Agregar al carrito"

**Archivos a crear:**
- `src/pages/tienda.js` (nueva)
- Agregar ruta en `main.js`

---

## 🟡 IMPORTANTE (Próximas 2 semanas)

### 4. 📊 Integración de Más Proveedores
**Opciones:**
- CSV de otros proveedores (formato a definir)
- APIs similares a ELIT
- Import manual Excel/CSV genérico

**Tareas:**
- [ ] Contactar proveedores para obtener CSV/API
- [ ] Crear endpoint genérico `/api/providersImport`
- [ ] UI en Settings para subir CSV
- [ ] Mapeo de columnas flexible

---

### 5. 🎨 Mejoras UX/UI
**Frontend Design:**
- [ ] Loading states en todas las acciones
- [ ] Skeleton loaders en catálogo/proveedores
- [ ] Toast notifications (éxito/error)
- [ ] Animaciones suaves (transiciones)
- [ ] Dark mode toggle (opcional)

**Responsive:**
- [ ] Verificar mobile (hamburger menu?)
- [ ] Cards responsivos en grid
- [ ] Modales mobile-friendly

---

### 6. ⚡ Performance
**Backend:**
- [ ] Caché en memoria (Node-cache) para productos
- [ ] Caché con TTL de 1 hora
- [ ] Endpoint `/api/cache/clear` para admins
- [ ] Rate limiting (express-rate-limit)

**Frontend:**
- [ ] Lazy load de imágenes
- [ ] Debounce en búsqueda (300ms)
- [ ] Virtual scrolling para listas grandes
- [ ] Code splitting por página

---

## 🟢 MEJORAS FUTURAS (Backlog)

### 7. 🧪 Testing
**Carpeta `tests/` actualmente vacía**
- [ ] Unit tests (Jest)
- [ ] E2E tests (Playwright/Cypress)
- [ ] CI/CD con GitHub Actions

---

### 8. 🔐 Seguridad
- [ ] Implementar bcrypt para passwords
- [ ] JWT con secret real (no hardcoded)
- [ ] HTTPS only en producción
- [ ] Sanitización de inputs
- [ ] CORS configurado correctamente

---

### 9. 📱 Features Nuevas
- [ ] Sistema de pedidos/cotizaciones
- [ ] Historial de búsquedas
- [ ] Favoritos/Wishlist
- [ ] Comparador de precios entre proveedores
- [ ] Dashboard de analytics (admin)

---

## 🛠️ Arquitectura Recomendada (Largo Plazo)

### Si decidís migrar a framework moderno:
**Opción A: React + Vite**
- Más fácil de mantener
- Mejor ecosistema de componentes
- TypeScript out of the box

**Opción B: Mantener Vanilla JS**
- Crear sistema de componentes custom
- Mejorar el router actual
- Agregar state management simple

**Mi recomendación:** Mantener vanilla por ahora, refactorizar código duplicado.

---

## 📋 Checklist Próximos 7 Días

1. [ ] Ejecutar `initAdminUsers.js`
2. [ ] Testear creación de usuarios desde Settings
3. [ ] Revisar límite de 100 items en catálogo
4. [ ] Crear página de venta pública con margen
5. [ ] Agregar loading states básicos
6. [ ] Contactar proveedores para APIs/CSVs

---

## 📞 Preguntas Pendientes

1. **¿Qué proveedores querés integrar primero?**
   - Nombres de proveedores
   - ¿Tienen API o solo CSV?

2. **¿La página de venta pública necesita carrito?**
   - O solo "consultar por WhatsApp"
   - O email con cotización

3. **¿Qué rol van a tener los clientes finales?**
   - Solo ver precios
   - Pedir cotizaciones
   - Hacer pedidos

4. **¿Necesitás reportes/analytics?**
   - Productos más buscados
   - Precios históricos
   - Etc.

---

**Próximo paso:** ¿Empezamos con el punto 2 (límite de 100 items) o el punto 3 (página de venta pública)?
