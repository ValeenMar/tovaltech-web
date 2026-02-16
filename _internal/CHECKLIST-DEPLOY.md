# ✅ CHECKLIST PRE-DEPLOY

**USA ESTE ARCHIVO ANTES DE HACER PUSH**

---

## 📋 VERIFICACIONES LOCALES

### 1. Estructura de Archivos

```bash
# Verificar que estas carpetas existan:
ls -la api/
ls -la src/
ls -la assets/
ls -la .github/workflows/

# Debe mostrar:
# ✓ api/ con subcarpeta functions/
# ✓ src/ con subcarpeta pages/
# ✓ assets/ con logos
# ✓ .github/workflows/ con archivo .yml
```

### 2. NO Debe Haber .env

```bash
# Esto NO debe existir:
ls -la api/.env

# Si existe, eliminarlo:
rm api/.env
```

### 3. Verificar package.json

```bash
cat api/package.json

# Debe tener estas dependencias:
# - @azure/functions
# - @azure/data-tables
```

### 4. Verificar .gitignore

```bash
cat .gitignore | grep ".env"

# Debe incluir:
# api/.env
# api/local.settings.json
```

---

## 🔧 CONFIGURACIÓN AZURE

### Variables que DEBEN estar en Azure Portal:

```
✓ JWT_SECRET
✓ PRODUCTS_TABLE_NAME
✓ PROVIDERS_TABLE_NAME  
✓ CHAT_TABLE_NAME
✓ USERS_TABLE_NAME
✓ NEWBYTES_TOKEN
✓ ELIT_USER_ID
✓ ELIT_TOKEN
✓ STORAGE_CONNECTION_STRING (ya debería estar)
```

**Verificar en:** Azure Portal → tovaltech-web → Configuración → Variables de entorno

---

## 🚀 ANTES DE HACER PUSH

```bash
# 1. Agregar todo
git add .

# 2. Verificar qué se va a subir
git status

# 3. Verificar que NO se suba .env
git status | grep ".env"
# (NO debe aparecer nada)

# 4. Commit
git commit -m "deploy: master file completo"

# 5. Push
git push origin main
```

---

## ✅ DESPUÉS DEL PUSH

### Paso 1: Verificar GitHub Actions

1. Ve a: https://github.com/ValeenMar/tovaltech-web/actions
2. Debe aparecer un workflow corriendo
3. Esperá hasta que termine (2-3 minutos)
4. Debe decir: **✓ Build and Deploy Job**

### Paso 2: Probar la API

```bash
# Healthcheck
curl https://polite-cliff-0828e1f10.5.azurestaticapps.net/api/health

# Debe responder:
# {"status":"healthy","timestamp":"..."}
```

Si da **404**, las Functions NO se deployaron.

### Paso 3: Probar Frontend

Abrí en el navegador:
```
https://polite-cliff-0828e1f10.5.azurestaticapps.net/catalogo
```

Debe mostrar productos (no solo 4 MOCK).

---

## 🐛 SI FALLA

### GitHub Actions da error

1. Click en el workflow fallido
2. Click en "Build and Deploy Job"
3. Expandir los logs
4. Buscar líneas rojas con errores
5. Captura de pantalla y buscar ayuda

### API da 404

**Causa:** Azure Functions no se deployó.

**Solución:**
1. Verificá que `/api/` esté en el repo
2. Verificá que `api/host.json` exista
3. Verificá que `api/package.json` exista
4. Re-push con `git push -f origin main`

### Solo veo productos MOCK

**Causa:** La API no está funcionando.

**Solución:**
1. Verificá `/api/health` (debe responder)
2. Verificá variables de entorno en Azure
3. Revisá logs en Azure Portal → Log stream

---

## 📱 CONTACTO RÁPIDO

Si todo falla después de seguir TODOS los pasos:

1. Captura GitHub Actions (logs completos)
2. Captura Variables Azure
3. Resultado de `curl /api/health`
4. Mandá todo junto

---

**Última verificación:** Antes de hacer push, ejecutá:

```bash
# Verificación rápida
ls -la api/.env 2>/dev/null && echo "⚠️  PELIGRO: .env existe" || echo "✅ Sin .env"
ls -la api/functions/*.js | wc -l | xargs -I {} echo "✅ {} funciones encontradas"
ls -la .github/workflows/*.yml | wc -l | xargs -I {} echo "✅ {} workflow encontrado"
```

Todo debe mostrar ✅
