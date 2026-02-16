# Backend API - Azure Functions

## ⚠️ Importante

Este directorio debe contener las **Azure Functions existentes** del proyecto original. El refactor **NO modifica el backend**, solo el frontend.

## Funciones Requeridas

Asegurarse de mantener las siguientes API functions:

### Core APIs
- `getProducts` - Obtener lista de productos
- `getProduct` - Obtener producto por SKU
- `createProduct` - Crear nuevo producto
- `updateProduct` - Actualizar producto
- `deleteProduct` - Eliminar producto

### Providers
- `getProviders` - Listar proveedores
- `importELIT` - Importar desde ELIT
- `importNewBytes` - Importar desde NewBytes

### Auth
- `login` - Autenticación con JWT
- `me` - Obtener usuario actual

### Utilities
- `dollar-rate` - Obtener tipo de cambio USD→ARS

## Estructura Esperada

```
/api/
├── host.json
├── local.settings.json
├── package.json
└── functions/
    ├── getProducts/
    │   ├── function.json
    │   └── index.js
    ├── getProviders/
    │   ├── function.json
    │   └── index.js
    ├── login/
    │   ├── function.json
    │   └── index.js
    └── ...
```

## Variables de Entorno

Configurar en Azure Portal o `local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_STORAGE_CONNECTION_STRING": "<tu-connection-string>",
    "JWT_SECRET": "<tu-secret>",
    "ALLOWED_ORIGINS": "http://localhost:3000,https://tovaltech.azurestaticapps.net"
  }
}
```

## Deploy

El backend se deployea independientemente del frontend:

```bash
cd api
npm install
func azure functionapp publish <app-name>
```

## Testing Local

```bash
cd api
npm install
func start
```

Las APIs estarán disponibles en `http://localhost:7071/api/`

---

**Nota**: Si no tienes el código del backend original, contactar al desarrollador para obtener las Azure Functions existentes.
