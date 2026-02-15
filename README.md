# 🚀 TovalTech Web - Version MEGA

**Versión Completa con NewBytes, ELIT, Carrito, y más**

---

## 🎯 NUEVAS FUNCIONALIDADES

### ✅ Importación NewBytes
- **Ubicación:** `/api/functions/providersNewBytesImport.js`
- **Endpoint:** `POST /api/providersNewBytesImport`
- **Token configurado** en variables de entorno

### ✅ Carrito de Cotización
- **Ubicación:** `/src/pages/carrito.js` + `/src/components/cart.js`
- Múltiples listas de productos
- Compartir por WhatsApp
- Cálculo automático con IVA + margen
- Exportar a PDF (próximamente)

### ✅ Limpieza de Duplicados
- **Script:** `/api/scripts/cleanDuplicates.js`
- Elimina productos duplicados por nombre
- Mantiene el más reciente de cada grupo

### ✅ Assets Mejorados
- Logos SVG temporales en `/assets/`
- Favicon incluido
- Fallback automático a texto si falla imagen

---

## 📦 INSTALACIÓN RÁPIDA

### 1. Configurar Variables de Entorno

**Azure Portal → tovaltech-web → Configuración → Variables de aplicación:**

```
STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
JWT_SECRET=tu-secreto-super-largo-y-aleatorio
CHAT_TABLE_NAME=chatlog
PRODUCTS_TABLE_NAME=Products
PROVIDERS_TABLE_NAME=Providers
USERS_TABLE_NAME=Users
ELIT_USER_ID=29574
ELIT_TOKEN=tu-token-elit
NEWBYTES_TOKEN=c6caafe18ab17302a736431e21c9b5
```

### 2. Subir al Repositorio

```bash
# Clonar tu repo
git clone https://github.com/ValeenMar/tovaltech-web.git
cd tovaltech-web

# Reemplazar con este contenido
# (o descomprimir el ZIP directamente en la carpeta)

# Commitear
git add .
git commit -m "feat: version mega con newbytes, carrito y más"
git push origin main
```

### 3. Deploy Automático

Azure Static Web Apps detectará el push y hará deploy automático.

---

## 🔧 SCRIPTS ÚTILES

### Importar Productos de NewBytes

```bash
# Llamar al endpoint
curl -X POST https://tu-sitio.azurestaticapps.net/api/providersNewBytesImport
```

### Limpiar Duplicados

```bash
cd api/scripts
node cleanDuplicates.js
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
/
├── api/                          # Azure Functions
│   ├── functions/
│   │   ├── providersNewBytesImport.js   # NUEVO
│   │   ├── getProducts.js
│   │   └── ...
│   ├── lib/
│   │   └── auth.js              # Auth centralizado
│   ├── scripts/
│   │   └── cleanDuplicates.js    # NUEVO
│   └── .env.example              # Template de config
│
├── src/
│   ├── pages/
│   │   ├── carrito.js            # NUEVO - Carrito de cotización
│   │   ├── tienda.js
│   │   └── catalogo.js
│   ├── components/
│   │   ├── cart.js               # NUEVO - Lógica del carrito
│   │   ├── cards.js
│   │   └── table.js
│   └── styles/
│       └── global.css
│
├── assets/                       # NUEVO
│   ├── tovaltech.svg
│   ├── favicon.svg
│   └── preview.html
│
└── index.html
```

---

## 🛠️ USO DEL CARRITO

### Agregar al Carrito (desde tienda/catálogo)

```javascript
import { addToCart } from "../components/cart.js";

// En el click de un producto
addToCart(producto);
```

### Ver el Carrito

Navegar a `/carrito` en el sitio.

### Compartir por WhatsApp

El botón genera un mensaje automático con todos los productos y el total.

---

## 🔐 SEGURIDAD

### ⚠️ IMPORTANTE: NO HAY .env EN EL REPO

Este proyecto NO incluye archivos `.env` con credenciales reales.

**Todas las variables sensibles deben configurarse en:**
- Azure Portal → Configuración de la aplicación
- O en tu `.env` local (nunca commitear)

---

## 📊 API ENDPOINTS

### Productos

- `GET /api/getProducts` - Lista productos
- `GET /api/getProducts?provider=elit` - Filtrar por proveedor
- `GET /api/getProducts?q=ssd` - Buscar productos

### Importación

- `POST /api/providersElitImport` - Importar de ELIT
- `POST /api/providersNewBytesImport` - Importar de NewBytes

### Proveedores

- `GET /api/getProviders` - Lista proveedores

---

## 🎨 PERSONALIZACIÓN

### Cambiar Logos

1. Reemplazar `/assets/tovaltech.svg` con tu logo
2. Convertir a PNG si querés: https://www.svgtopng.com/
3. Actualizar `/assets/favicon.svg` y generar .ico en https://favicon.io

### Ajustar Colores

Editar variables CSS en `/src/styles/global.css`:

```css
:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  /* ... */
}
```

---

## 🐛 TROUBLESHOOTING

### "No se importan productos de NewBytes"

1. Verificar que `NEWBYTES_TOKEN` esté configurado en Azure
2. Probar el endpoint manualmente con curl
3. Ver logs en Azure Portal → Functions → Monitor

### "Productos duplicados"

Ejecutar script de limpieza:
```bash
cd api/scripts
STORAGE_CONNECTION_STRING="..." node cleanDuplicates.js
```

### "El logo no aparece"

El sitio usa fallback automático. Si falla la imagen, muestra "TovalTech" en texto.

---

## 📞 CONTACTO

**TovalTech**
- Email: valentin@toval-tech.com
- Tel: +54 9 11 6883-1802

---

## 📝 CHANGELOG

### Version MEGA (2026-02-15)

**Nuevas Features:**
- ✅ Importación automática de NewBytes
- ✅ Carrito de cotización con WhatsApp
- ✅ Script de limpieza de duplicados
- ✅ Assets (logos + favicon)
- ✅ Auth centralizado en `/api/lib/auth.js`
- ✅ .env.example completo
- ✅ Sin archivos sensibles en el repo

**Mejoras:**
- Refactorización de autenticación
- Mejor manejo de errores
- Documentación completa

---

🚀 **¡Todo listo para producción!**
