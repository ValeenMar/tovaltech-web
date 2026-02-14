# 🔧 Solución al Error 403 en Settings

## 🎯 Problema
Cuando intentás crear usuarios desde `/settings`, te aparece error 403 "Failed to load resource: the server responded with a status of 403 ()".

## 🔍 Causa
El sistema tiene dos partes:
1. **Login** te da acceso con email @toval-tech.com
2. **Users API** busca el usuario en la tabla Azure "Users"

El problema: tu usuario no existe en la tabla Users, entonces cuando intentás crear otro usuario, la API verifica tu token y no te encuentra en la base de datos.

## ✅ Solución (3 opciones)

### Opción 1: Script Automático (RECOMENDADO)

Correr este comando desde la carpeta `api/`:

```bash
cd api
node scripts/initAdminUsers.js
```

Esto va a:
- Crear la tabla Users si no existe
- Agregar tu usuario valentin@toval-tech.com como admin
- Agregar mauricio@toval-tech.com como admin

Luego:
1. Cerrá sesión en la web (`/logout`)
2. Volvé a loguearte con `valentin@toval-tech.com` / `Milanesa`
3. Andá a `/settings` y vas a poder crear usuarios

---

### Opción 2: Desde Azure Portal (Manual)

1. Entrá a Azure Portal
2. Andá a tu Storage Account
3. Buscá "Tables" en el menú
4. Abrí la tabla "Users"
5. Agregá una nueva entidad con estos campos:
   ```
   PartitionKey: user
   RowKey: valentin@toval-tech.com
   email: valentin@toval-tech.com
   password: Milanesa
   name: Valentin
   role: admin
   createdAt: 2025-02-14T00:00:00.000Z
   createdBy: system
   ```
6. Guardá y listo

---

### Opción 3: Desde la API (POST manual)

Si tenés Postman o similar:

```bash
POST https://TU-DOMINIO.azurestaticapps.net/api/users
Authorization: Bearer TU_TOKEN_ACTUAL
Content-Type: application/json

{
  "email": "nuevo@toval-tech.com",
  "password": "Milanesa",
  "name": "Nuevo Usuario",
  "role": "admin"
}
```

*(Pero esto no va a funcionar porque tenés el 403, así que usá Opción 1 o 2)*

---

## 🧪 Verificación

Después de correr el script:

1. **Verificá que el usuario existe:**
   ```bash
   # Desde Azure Portal > Storage Account > Tables > Users
   # Deberías ver: valentin@toval-tech.com
   ```

2. **Cerrá sesión y volvé a loguearte**
   - Esto va a generar un nuevo token que incluya tu info de la DB

3. **Probá crear un usuario desde /settings**
   - Debería funcionar sin errores 403

---

## 📝 Mejoras Aplicadas

También actualicé `login.js` para que:
1. **Primero** busque el usuario en la tabla Users
2. Si no está, use el fallback del dominio @toval-tech.com
3. Esto hace el sistema más robusto

---

## 🚀 Próximos Pasos Recomendados

Una vez que esto funcione:

1. **Cambiar passwords** (usar algo más seguro que "Milanesa")
2. **Implementar bcrypt** para hashear contraseñas (TODO en el código)
3. **Agregar validación de email** en el frontend
4. **Crear un usuario "cliente" de prueba** para testing

---

## 🆘 Si Sigue Sin Funcionar

1. Verificá que `STORAGE_CONNECTION_STRING` esté en el `.env` del API
2. Chequeá los logs en Azure Functions > Monitor
3. Revisá la consola del navegador (F12) para ver el token que estás enviando
4. Avisame y vemos juntos el error específico

---

**Autor:** Claude + Valentin  
**Fecha:** 2025-02-14
