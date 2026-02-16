# TovalTech - E-commerce Refactored

Versión refactorizada del proyecto TovalTech con separación de vistas cliente/admin, nuevo home profesional, filtros mejorados y diseño moderno.

## ✨ Cambios Principales

### 1. **Nuevo Home E-commerce**
- Hero simple con propuesta de valor clara
- Grid de categorías clickeables (6 categorías principales)
- Productos destacados (grid de 6-8 productos)
- Sección de marcas con scroll animado
- Bloques "¿Qué hacemos?" (Cotizaciones, Abastecimiento, Soporte)
- Diseño responsive y profesional

### 2. **Separación de Vistas Cliente/Admin**
**Vista Pública** (sin login):
- Home
- Tienda (precios con IVA incluido, filtros simplificados)
- Contacto

**Vista Cliente** (login customer):
- Todo lo anterior +
- Carrito
- Mis pedidos

**Vista Admin** (login admin):
- Todo lo anterior +
- Catálogo completo (con filtros avanzados)
- Proveedores
- Configuración
- Jeffrey (asistente admin)

### 3. **Filtros Sin Scroll Horizontal**
**Clientes**:
- Buscar
- Categoría + Subcategoría (select único)
- Marca
- Precio min/max (con pills predefinidas)
- Solo con stock (checkbox)
- IVA incluido (siempre ON)
- Toggle USD/ARS

**Admin** (adicional):
- Proveedor
- FX USD→ARS manual
- Toggle IVA incluido/excluido

### 4. **Componentes Reutilizables**
- `ProductCard` único para tienda y catálogo
- `FilterSidebar` reutilizable con modo cliente/admin
- Helpers de datos centralizados

### 5. **Diseño Moderno**
- Tipografía distintiva (Clash Display + Inter + JetBrains Mono)
- Paleta de colores tech (dark/light themes)
- Animaciones sutiles y transiciones suaves
- Mobile-first responsive

## 🚀 Deploy Instructions

### Opción 1: Deploy Directo a GitHub

```bash
# 1. Descomprimir el .zip
unzip tovaltech-refactored.zip
cd tovaltech-refactored

# 2. Inicializar git (si es nuevo repo)
git init
git add .
git commit -m "Refactor complete: new home, client/admin separation, improved filters"

# 3. Push a tu repo
git remote add origin <tu-repo-url>
git push -u origin main
```

### Opción 2: Deploy a Azure Static Web Apps

1. Ir a Azure Portal
2. Crear nuevo "Static Web App"
3. Conectar con tu repo de GitHub
4. Configurar build:
   - **App location**: `/`
   - **API location**: `/api`
   - **Output location**: `/`

### Opción 3: Deploy Local (Testing)

```bash
# Instalar http-server globalmente
npm install -g http-server

# Ejecutar servidor local
http-server . -p 3000

# Abrir http://localhost:3000
```

## 📁 Estructura del Proyecto

```
tovaltech-refactored/
├── index.html              # Punto de entrada
├── README.md               # Este archivo
├── package.json            # Dependencias (si las hay)
│
├── src/
│   ├── main.js             # Router con separación cliente/admin
│   │
│   ├── pages/
│   │   ├── home.js         # Home e-commerce
│   │   ├── tienda.js       # Tienda (cliente)
│   │   └── catalogo.js     # Catálogo (admin)
│   │
│   ├── components/
│   │   ├── ProductCard.js      # Tarjeta de producto reutilizable
│   │   └── FilterSidebar.js    # Sidebar de filtros reutilizable
│   │
│   ├── utils/
│   │   └── dataHelpers.js      # Helpers para productos, FX, precios
│   │
│   └── styles/
│       ├── global.css      # Estilos globales y variables
│       ├── home.css        # Estilos del home
│       └── store.css       # Estilos tienda/catálogo
│
└── api/                    # Azure Functions (backend existente)
    └── functions/
        ├── getProducts/
        ├── getProviders/
        ├── login/
        └── ...
```

## 🔧 Configuración

### Variables de Entorno (Backend)

Asegurarse de tener configuradas en Azure:

```
AZURE_STORAGE_CONNECTION_STRING=<tu-connection-string>
JWT_SECRET=<tu-secret>
```

### LocalStorage (Frontend)

El frontend usa localStorage para:
- `toval_theme`: tema dark/light
- `toval_token`: JWT de autenticación
- `toval_cart`: carrito de compras
- `toval_margin_pct`: margen de ganancia (admin)

## 🎨 Personalización

### Colores

Editar variables CSS en `/src/styles/global.css`:

```css
:root {
  --accent: #00e5ff;        /* Color principal */
  --accent2: rgba(0, 229, 255, 0.12);  /* Acento suave */
  /* ... más variables */
}
```

### Categorías del Home

Editar array en `/src/pages/home.js`:

```javascript
const CATEGORIES = [
  {
    id: 'monitores',
    name: 'Monitores',
    icon: '🖥️',
    description: 'Pantallas LED, IPS, QHD, 4K'
  },
  // ... más categorías
];
```

### Marcas

Editar array en `/src/pages/home.js` (sección "Brands"):

```javascript
['DELL EMC', 'LENOVO', 'CISCO', ...]
```

## 📱 Mobile

Todo el diseño es **mobile-first**:
- Filtros en drawer lateral (overlay en mobile)
- Grid adaptativo de productos
- Header colapsable
- Botones y controles touch-friendly

## 🔐 Autenticación

El router verifica roles automáticamente:
- Rutas públicas: acceso libre
- Rutas cliente: requiere login (customer o admin)
- Rutas admin: solo admin

```javascript
// En main.js
const ADMIN_ROUTES = ['/catalogo', '/proveedores', '/configuracion'];
```

## 🐛 Troubleshooting

### "Productos no cargan"
- Verificar que el backend esté corriendo
- Revisar network tab para errores de API
- Verificar conexión a Azure Table Storage

### "Filtros no funcionan"
- Limpiar localStorage
- Revisar console para errores JS
- Verificar estructura de datos de productos

### "Login no funciona"
- Verificar JWT_SECRET en backend
- Revisar que /api/login esté disponible
- Limpiar localStorage y volver a intentar

## 📝 Notas Importantes

1. **Productos Destacados**: Se seleccionan por `updatedAt` (más nuevos primero). Filtrados para excluir `stock === 0`.

2. **Precios**: 
   - **Clientes**: Siempre con IVA incluido
   - **Admin**: Toggle para ver con/sin IVA

3. **FX USD→ARS**:
   - **Clientes**: Automático desde API `/api/dollar-rate`
   - **Admin**: Puede forzar FX manual en filtros

4. **Margen**: Solo admin puede ajustar margen de ganancia (toolbar catálogo)

## ✅ Checklist de Deploy

- [ ] Descomprimir y revisar archivos
- [ ] Actualizar URLs de API si cambiaron
- [ ] Configurar variables de entorno en Azure
- [ ] Push a GitHub
- [ ] Conectar con Azure Static Web Apps
- [ ] Verificar que backend responda
- [ ] Testear login admin/cliente
- [ ] Testear filtros en mobile
- [ ] Verificar que home se vea correctamente

## 🎯 Próximos Pasos (Opcional)

- [ ] Implementar búsqueda avanzada con Algolia
- [ ] Agregar página de producto individual
- [ ] Implementar checkout completo
- [ ] Dashboard de admin con analytics
- [ ] Sistema de notificaciones
- [ ] Integración con MercadoPago

---

**Desarrollado por:** Refactor completo del proyecto original TovalTech  
**Versión:** 2.0.0  
**Fecha:** Febrero 2026
