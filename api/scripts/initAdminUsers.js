/**
 * Script para inicializar usuarios admin en Azure Tables
 * 
 * Uso:
 * node api/scripts/initAdminUsers.js
 */

require("dotenv").config();
const { TableClient } = require("@azure/data-tables");

async function initAdminUsers() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  
  if (!conn) {
    console.error("❌ STORAGE_CONNECTION_STRING no está configurado en .env");
    process.exit(1);
  }

  console.log("📦 Conectando a Azure Table Storage...");
  const client = TableClient.fromConnectionString(conn, "Users");

  // Crear la tabla si no existe
  try {
    await client.createTable();
    console.log("✅ Tabla 'Users' creada");
  } catch (err) {
    if (err.statusCode === 409) {
      console.log("ℹ️  Tabla 'Users' ya existe");
    } else {
      throw err;
    }
  }

  // Usuarios admin a crear
  const admins = [
    {
      email: "valentin@toval-tech.com",
      password: "Milanesa", // TODO: hashear en producción
      name: "Valentin",
      role: "admin",
    },
    {
      email: "mauricio@toval-tech.com",
      password: "Milanesa",
      name: "Mauricio",
      role: "admin",
    },
  ];

  console.log("\n👥 Creando/actualizando usuarios admin...");

  for (const admin of admins) {
    const emailLower = admin.email.toLowerCase();
    
    try {
      // Verificar si ya existe
      let existing = null;
      try {
        existing = await client.getEntity("user", emailLower);
      } catch (err) {
        if (err.statusCode !== 404) throw err;
      }

      const user = {
        partitionKey: "user",
        rowKey: emailLower,
        email: emailLower,
        password: admin.password,
        name: admin.name,
        role: admin.role,
        createdAt: existing?.createdAt || new Date().toISOString(),
        createdBy: existing?.createdBy || "system",
        updatedAt: new Date().toISOString(),
      };

      if (existing) {
        await client.updateEntity(user, "Replace");
        console.log(`✅ Usuario actualizado: ${emailLower}`);
      } else {
        await client.createEntity(user);
        console.log(`✅ Usuario creado: ${emailLower}`);
      }
    } catch (err) {
      console.error(`❌ Error con ${emailLower}:`, err.message);
    }
  }

  console.log("\n✨ Proceso completado");
}

initAdminUsers().catch((err) => {
  console.error("💥 Error fatal:", err);
  process.exit(1);
});
