# 🚀 INSTRUCCIONES DE DEPLOY - TOVALTECH

## ✅ CAMBIOS IMPLEMENTADOS

### 1. **CARRITO DE COMPRAS FUNCIONAL** 🛒
- Widget en navbar con contador
- Página `/cart` completa
- Agregar/quitar productos
- Cálculo automático USD → ARS (BNA)
- IVA incluido (21%)
- Cotización por WhatsApp y Email

### 2. **TROLLEO MUSICAL PARA TOBIAS** 🎵
- Se activa al login de `tobias@toval-tech.com`
- Reproduce `/assets/troll.mp3` en loop
- Botón de control en **posición aleatoria** (cambia cada recarga)
- Volumen mínimo: 35% (no puede bajar más)
- Control de volumen oculto al pasar mouse

### 3. **PAGINACIÓN** 📄
- 50 productos por página
- Botones de navegación
- Info de "mostrando X-Y de Z"

### 4. **PRECIOS CON MARGEN** 💰
- Margen por defecto: 25%
- Mostrar precio final en USD y ARS
- IVA incluido y aclarado
- Cotización dólar BNA automática

### 5. **FOOTER COMPLETO** 📝
- Newsletter (2 secciones)
- Links útiles
- Contacto completo
- 16 marcas trabajadas
- Copyright y legal

### 6. **FONDO INFINITO** 🌌
- Sin cortes al hacer scroll
- `background-attachment: fixed`

---

## 📦 ARCHIVOS NUEVOS

```
api/functions/
├── cart.js              (API carrito - placeholder)
└── dollarRate.js        (Cotización BNA con fallback)

src/components/
├── cartWidget.js        (Ícono carrito + localStorage)
└── pagination.js        (Sistema paginación 50 items)

src/pages/
└── cart.js              (Página completa del carrito)

src/utils/
└── musicTroll.js        (Sistema trolleo Tobias)
```

---

## 🔧 ARCHIVOS MODIFICADOS

```
index.html               → Footer completo agregado
src/main.js              → Carrito + trolleo integrado
src/styles/global.css    → +695 líneas de estilos
src/pages/catalogo.js    → Paginación + botón carrito
```

---

## 🚨 CONFIGURACIÓN AZURE

### Variables de entorno necesarias:

1. **NEWBYTES_TOKEN** (IMPORTANTE)
   ```
   Valor: c6caafe18ab17302a736431e21c9b5
   ```
   Sin este token, New Bytes devolverá 0 items.

2. **Existentes** (mantener)
   - STORAGE_CONNECTION_STRING
   - ELIT_USER_ID
   - ELIT_TOKEN
   - AUTH_KEY

---

## 📝 DEPLOYMENT

```bash
# 1. Copiar archivos a tu proyecto
unzip tovaltech-web-FINAL.zip
cd tovaltech-web

# 2. Revisar cambios
git status

# 3. Commit y push
git add .
git commit -m "feat: carrito, trolleo, paginación, footer y precios con margen"
git push origin main

# 4. Esperar deploy (~3 min)
# Ver en: https://github.com/ValeenMar/tovaltech-web/actions

# 5. Probar
# https://polite-cliff-0828e1f10.4.azurestaticapps.net
```

---

## 🧪 TESTING

### Carrito:
1. Ir a `/catalogo`
2. Hacer hover sobre producto → Aparece botón `+`
3. Click → "Agregado al carrito"
4. Ver ícono carrito en navbar (contador)
5. Click en carrito → Ver productos
6. Probar WhatsApp y Email

### Trolleo Tobias:
1. Login con `tobias@toval-tech.com`
2. La música debería empezar automáticamente
3. Buscar botón 🎵 (en posición aleatoria)
4. Verificar que volumen no baje de 35%

### Paginación:
1. Ir a `/catalogo`
2. Scroll hasta abajo
3. Debe haber botones de página
4. Click → Recarga primeros 50

### New Bytes:
```powershell
$dom = "https://polite-cliff-0828e1f10.4.azurestaticapps.net"
$pass = "Milanesa"
$h = @{ "x-app-password" = $pass }

# Re-importar New Bytes
Invoke-RestMethod -Uri "$dom/api/providers/newbytes/import?max=1000" -Headers $h -Method POST
```

---

## ⚠️ IMPORTANTE

**NEWBYTES_TOKEN debe ser exactamente:**
```
c6caafe18ab17302a736431e21c9b5
```

Este es el hash de tu cuenta que viene en la URL del CSV.

**Si no funciona:**
1. Verificar token en Azure Portal
2. Esperar 3-5 min después del deploy
3. Hacer hard refresh (Ctrl + Shift + R)
4. Ver console del navegador (F12)

---

## 📞 CONTACTO

**WhatsApp:** +54 9 11 2341-3674
**Emails:** valentin@toval-tech.com, tobias@toval-tech.com

---

¡LISTO PARA DEPLOY! 🚀
