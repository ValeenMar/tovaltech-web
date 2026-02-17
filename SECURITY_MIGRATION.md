# 🔐 MIGRACIÓN DE SEGURIDAD - INSTRUCCIONES

## ⚠️ IMPORTANTE - URGENTE

Esta actualización implementa seguridad crítica para contraseñas y JWT. **DEBES seguir estos pasos INMEDIATAMENTE después del deploy**.

---

## 📋 Cambios Implementados

### ✅ Seguridad
1. **Bcrypt** para hashing de contraseñas (reemplaza texto plano)
2. **JWT real** con jsonwebtoken (reemplaza firma insegura)
3. **Validación de inputs** con Joi
4. **Eliminadas** todas las credenciales hardcoded

### 🔧 Backend
- `api/functions/login.js` - Autenticación segura
- `api/functions/users.js` - CRUD con passwords hasheados
- `api/scripts/migratePasswords.js` - Script de migración

---

## 🚀 PASOS CRÍTICOS POST-DEPLOY

### 1. Configurar Variables de Entorno en Azure

Ve a **Azure Portal → Static Web App → Configuration**:

```env
JWT_SECRET=<genera-un-secret-aleatorio-largo>
STORAGE_CONNECTION_STRING=<tu-connection-string-actual>
```

**Generar JWT_SECRET seguro**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el output y úsalo como `JWT_SECRET`.

---

### 2. Migrar Contraseñas de Usuarios Existentes

**ANTES** debes editar `api/scripts/migratePasswords.js`:

```javascript
const USERS_TO_MIGRATE = [
  {
    email: "tu-email@toval-tech.com", // ⚠️ Cambiar por tu email real
    password: "Milanesa", // La contraseña actual
    name: "Tu Nombre",
    role: "admin",
  },
  {
    email: "socio@ejemplo.com", // ⚠️ Email del socio
    password: "Milanesa", // Contraseña actual
    name: "Nombre Socio",  
    role: "admin",
  },
];
```

**Ejecutar migración**:
```bash
cd api
node scripts/migratePasswords.js
```

Verás algo como:
```
🚀 Iniciando migración de contraseñas a bcrypt
✅ Conexión a Azure Table Storage establecida
🔄 Procesando usuario: tu-email@toval-tech.com
   ✅ Usuario creado con password hasheado
   🔐 Verificación de hash: ✅ OK
✅ Migración completada exitosamente
```

---

### 3. Probar Login

1. Ve a tu sitio web
2. Intenta login con:
   - Email: `tu-email@toval-tech.com`
   - Password: `Milanesa`

Si funciona ✅ → Continúa al paso 4  
Si NO funciona ❌ → Revisa los logs de Azure Functions

---

### 4. CAMBIAR CONTRASEÑAS

**🚨 CRÍTICO**: La contraseña "Milanesa" está en GitHub público. Cámbienla INMEDIATAMENTE:

1. Login en el sitio
2. (Si tienen UI de cambio de password, úsenla)
3. O ejecutar directamente:

```bash
# Desde api/
node -e "
const bcrypt = require('bcrypt');
const { TableClient } = require('@azure/data-tables');

async function changePassword() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const client = TableClient.fromConnectionString(conn, 'Users');
  
  const email = 'tu-email@toval-tech.com'; // TU EMAIL
  const newPassword = 'TU_NUEVA_CONTRASEÑA_SEGURA'; // ⚠️ Cambiar
  
  const user = await client.getEntity('user', email);
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await client.updateEntity(user, 'Merge');
  
  console.log('✅ Contraseña actualizada');
}

changePassword();
"
```

---

### 5. Verificar Seguridad

Checklist final:

- [ ] JWT_SECRET configurado en Azure (NO usar el default)
- [ ] Usuarios migrados con bcrypt
- [ ] Login funciona correctamente
- [ ] Contraseñas cambiadas (NO usar "Milanesa")
- [ ] No hay credenciales en el código
- [ ] `api/local.settings.json` en .gitignore

---

## 🔍 Verificar que Funcionó

### Login Exitoso
En Azure Functions logs deberías ver:
```
✅ Login exitoso: tu-email@toval-tech.com admin
Token verified successfully: { email: '...', role: 'admin' }
```

### Si hay problemas

**Error: "Credenciales inválidas"**
→ La migración no corrió o el password está mal

**Error: "No se pudo conectar a la tabla Users"**
→ STORAGE_CONNECTION_STRING no configurado

**Error: "Invalid token"**
→ JWT_SECRET diferente entre generación y verificación

---

## 📱 Contacto

Si algo falla:
1. Revisa Azure Functions logs
2. Verifica las variables de entorno
3. Confirma que corrió el script de migración

---

## 🎯 Próximos Pasos (Opcional)

Ya con la seguridad básica:
- Implementar cambio de password desde UI
- Agregar rate limiting al login
- Implementar 2FA
- Logs de auditoría de accesos

---

**Creado**: 2026-02-17  
**Urgente**: Ejecutar migración después del deploy
