# 🚀 TovalTech Web - MASTER FILE

**Versión funcionando al 100% con NewBytes, ELIT, y Azure Functions**

---

## ⚡ DEPLOY EN 5 MINUTOS

### PASO 1: Configurar Variables en Azure

Ve a: **Azure Portal → tovaltech-web → Configuración → Variables de entorno**

Agregá estas variables (click "+ Nueva configuración de aplicación"):

```
JWT_SECRET
<generar-un-secreto-fuerte-y-unico>

PRODUCTS_TABLE_NAME
Products

PROVIDERS_TABLE_NAME
Providers

CHAT_TABLE_NAME
chatlog

USERS_TABLE_NAME
Users

NEWBYTES_TOKEN
<tu-token-de-newbytes>

ELIT_USER_ID
29574

ELIT_TOKEN
(tu token de ELIT)
```

Click en **"Guardar"** arriba.

---

### PASO 2: Subir al Repositorio

```bash
# 1. Clonar tu repo (o ir a la carpeta si ya lo tenés)
cd /ruta/a/tovaltech-web

# 2. Reemplazar TODO con este contenido
# (descomprimir el ZIP directamente en la carpeta)

# 3. Verificar que tenés estas carpetas:
ls -la
# Debe mostrar: api/, src/, assets/, index.html, etc.

# 4. Agregar y commitear
git add .
git commit -m "deploy: master file completo funcionando"

# 5. Push
git push origin main
```

---

### PASO 3: Verificar Deploy

1. Ve a: **GitHub → tu-repo → Actions**
2. Debería aparecer un workflow corriendo
3. Esperá 2-3 minutos hasta que diga "✓ Build and Deploy Job"
4. Si falla, revisá los logs

---

### PASO 4: Probar que Funciona

**Test 1: API Health Check**
```bash
curl https://polite-cliff-0828e1f10.5.azurestaticapps.net/api/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "timestamp": "..."
}
```

**Test 2: Importar NewBytes**
```bash
curl -X POST https://polite-cliff-0828e1f10.5.azurestaticapps.net/api/providersNewBytesImport
```

Respuesta esperada:
```json
{
  "ok": true,
  "provider": "newbytes",
  "stats": { ... }
}
```

**Test 3: Ver Productos**

Abrí en el navegador:
```
https://polite-cliff-0828e1f10.5.azurestaticapps.net/catalogo
```

Deberías ver productos reales (no los 4 MOCK).

---

## 🔍 TROUBLESHOOTING

### Problema: "404 en /api/..."

**Causa:** Las Azure Functions no se deployaron.

**Solución:**
1. Verificá que la carpeta `/api/` esté en el repo
2. Verificá que GitHub Actions corrió exitosamente
3. Revisá logs en: GitHub → Actions → último workflow

### Problema: "Variables de entorno no configuradas"

**Solución:**
1. Azure Portal → tovaltech-web → Configuración
2. Agregá TODAS las variables listadas arriba
3. Click "Guardar"
4. Esperá 1-2 minutos (Azure reinicia)

### Problema: "Solo veo 4 productos MOCK"

**Causa:** La API no está respondiendo, usa datos hardcodeados.

**Solución:**
1. Verificá que `/api/health` responda
2. Si da 404, las Functions no están deployadas
3. Si da error, revisá variables de entorno

---

## 📁 ESTRUCTURA DEL PROYECTO

```
/
├── .github/
│   └── workflows/
│       └── azure-static-web-apps-....yml  ← Deploy automático
│
├── api/                                    ← Azure Functions (Backend)
│   ├── functions/
│   │   ├── health.js                      ← Healthcheck
│   │   ├── getProducts.js                 ← Lista productos
│   │   ├── getProviders.js                ← Lista proveedores
│   │   ├── login.js                       ← Login
│   │   ├── providersElitImport.js         ← Import ELIT
│   │   └── providersNewBytesImport.js     ← Import NewBytes
│   ├── lib/
│   │   └── auth.js                        ← Auth centralizado
│   ├── scripts/
│   │   └── cleanDuplicates.js             ← Limpiar duplicados
│   ├── host.json                          ← Config Azure Functions
│   ├── package.json                       ← Dependencias
│   └── .env.example                       ← Template (SIN credenciales)
│
├── src/                                    ← Frontend
│   ├── pages/
│   │   ├── catalogo.js                    ← Página catálogo
│   │   ├── tienda.js                      ← Página tienda
│   │   └── ...
│   ├── components/
│   ├── styles/
│   └── utils/
│
├── assets/                                 ← Logos, favicon
├── index.html                              ← Página principal
└── staticwebapp.config.json                ← Config Azure SWA
```

---

## 🎯 ENDPOINTS DISPONIBLES

### Productos
- `GET /api/getProducts` - Lista todos
- `GET /api/getProducts?provider=newbytes` - Filtrar por proveedor
- `GET /api/getProducts?q=ssd` - Buscar

### Importación
- `POST /api/providersElitImport` - Importar ELIT
- `POST /api/providersNewBytesImport` - Importar NewBytes

### Proveedores
- `GET /api/getProviders` - Lista proveedores

### Auth
- `POST /api/login` - Login
- `GET /api/users` - Lista usuarios (admin)

### Health
- `GET /api/health` - Status de la API

---

## ⚠️ IMPORTANTE

### NO HAY .env EN EL REPO

Este proyecto NO incluye archivos `.env` con credenciales.

Todas las variables sensibles se configuran en:
- **Azure Portal → Configuración de la aplicación**

El archivo `.gitignore` está configurado para:
```
api/.env
api/local.settings.json
api/node_modules/
azurite_data/
_internal/LOG.md
```

---

## 🚨 SI ALGO FALLA

1. **Revisar GitHub Actions:**
   - GitHub → Actions → Ver el workflow que falló
   - Revisar logs detallados

2. **Revisar Variables de Entorno:**
   - Azure Portal → tovaltech-web → Configuración
   - Verificar que TODAS estén configuradas

3. **Revisar Logs de Functions:**
   - Azure Portal → tovaltech-web → Log stream
   - Ver errores en tiempo real

4. **Limpiar y Re-deployar:**
   ```bash
   git add .
   git commit --amend --no-edit
   git push -f origin main
   ```

---

## ✅ CHECKLIST FINAL

Antes de decir "funciona":

- [ ] Variables de entorno configuradas en Azure
- [ ] Push al repo exitoso
- [ ] GitHub Actions corrió sin errores
- [ ] `/api/health` responde OK
- [ ] `/catalogo` muestra productos reales (no MOCK)
- [ ] Login funciona
- [ ] Import NewBytes funciona

---

## 📞 SOPORTE

Si después de seguir TODOS los pasos sigue sin funcionar:

1. Captura de pantalla de GitHub Actions (logs)
2. Captura de Variables de Entorno en Azure
3. Resultado de `curl /api/health`

---

**Hecho con 💙 para TovalTech**

Versión: MASTER FILE v1.0
Fecha: 2026-02-15
