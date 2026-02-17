# 🔧 Cómo Obtener el Connection String de Azure

## El Problema

Tu `api/local.settings.json` tiene:
```json
"STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true"
```

Esto es para **emulador local**, NO para Azure real.

---

## ✅ Solución: Copiar Connection String de Azure

### Paso 1: Ir a Azure Portal

Según tu screenshot, ya estás en el lugar correcto:
1. Azure Portal → Resource Manager
2. **tovaltechtostorage01** (tu Storage Account)

### Paso 2: Obtener Access Keys

1. En el menú lateral izquierdo, busca **"Claves de acceso"** o **"Access keys"**
2. Click en "Show keys" o "Mostrar claves"
3. Verás algo como:

   ```
   key1
   Connection string: DefaultEndpointsProtocol=https;AccountName=tovaltechtostorage01;AccountKey=XXXXX...
   ```

4. **Copia TODA la Connection string** (click en el icono de copiar)

### Paso 3: Actualizar local.settings.json

Abrí `z:\tovaltech-web\api\local.settings.json` y reemplazá:

**ANTES**:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "APP_PASSWORD": "Milanesa",
    "STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true"
  }
}
```

**DESPUÉS**:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=tovaltechtostorage01;AccountKey=TU_KEY_AQUI==;EndpointSuffix=core.windows.net",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=tovaltechtostorage01;AccountKey=TU_KEY_AQUI==;EndpointSuffix=core.windows.net"
  }
}
```

⚠️ **IMPORTANTE**: Reemplazá `TU_KEY_AQUI` con el valor real que copiaste.

### Paso 4: Ejecutar Migración

Ahora sí va a funcionar:

```bash
cd z:\tovaltech-web\api
node scripts/migratePasswords.js
```

Deberías ver:
```
🚀 Iniciando migración de contraseñas existentes a bcrypt
✅ Conexión a Azure Table Storage establecida

📋 Encontrados X usuarios en la tabla

🔄 Procesando: valentin@toval-tech.com
   ✅ Migrado exitosamente (verificación: ✅)

✅ Migración completada
```

---

## 🎯 Después de la Migración

Una vez que veas "✅ Migración completada":

1. **Probá login** en el sitio con:
   - Email: `valentin@toval-tech.com`
   - Password: la misma password que usabas antes

2. **Debería funcionar** inmediatamente (misma password, ahora hasheada)

3. **NO necesitás cambiar tu password** (a menos que quieras)

---

## ❓ Si te perdiste

Decime y te ayudo a:
1. Buscar las claves de acceso en Azure Portal
2. Actualizar el archivo local.settings.json
3. Ejecutar el script

---

**Siguiente paso**: Copiá el connection string de Azure Portal 👆
