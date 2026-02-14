/**
 * Script para crear tabla Users y usuarios iniciales
 * Ejecutar UNA VEZ: node api/scripts/createUsersTable.js
 */

const { TableClient } = require("@azure/data-tables");
require("dotenv").config();

async function setup() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) {
    console.error("❌ STORAGE_CONNECTION_STRING no configurado");
    process.exit(1);
  }

  const client = TableClient.fromConnectionString(conn, "Users");

  // Crear tabla
  try {
    await client.createTable();
    console.log("✅ Tabla Users creada");
  } catch (err) {
    if (err.statusCode === 409) {
      console.log("ℹ️  Tabla Users ya existe");
    } else {
      throw err;
    }
  }

  // Crear usuarios iniciales
  const users = [
    {
      partitionKey: "user",
      rowKey: "admin@tovaltech.com", // TU EMAIL
      email: "admin@tovaltech.com",
      password: "Milanesa", // CAMBIAR
      name: "Admin TovalTech",
      role: "admin",
      createdAt: new Date().toISOString(),
    },
    {
      partitionKey: "user",
      rowKey: "tobias@tovaltech.com", // EMAIL DE TOBIAS
      email: "tobias@tovaltech.com",
      password: "Milanesa", // CAMBIAR
      name: "Tobias",
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  ];

  for (const user of users) {
    try {
      await client.upsertEntity(user, "Merge");
      console.log(`✅ Usuario creado: ${user.email} (${user.role})`);
    } catch (err) {
      console.error(`❌ Error creando ${user.email}:`, err.message);
    }
  }

  console.log("\n🎉 Setup completo. Ya podés hacer login.");
}

setup().catch(console.error);

/**
 * Script para crear tabla Users
 * Ejecutar UNA VEZ: node api/scripts/createUsersTable.js
 */

const { TableClient } = require("@azure/data-tables");

async function setup() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) {
    console.error("❌ Set STORAGE_CONNECTION_STRING en .env o variables de entorno");
    process.exit(1);
  }

  const client = TableClient.fromConnectionString(conn, "Users");

  // Crear tabla
  try {
    await client.createTable();
    console.log("✅ Tabla Users creada");
  } catch (err) {
    if (err.statusCode === 409) {
      console.log("ℹ️  Tabla Users ya existe");
    } else {
      throw err;
    }
  }

  console.log("\n🎉 Setup completo.");
  console.log("💡 Usuarios @toval-tech.com tienen acceso admin automático");
  console.log("💡 Otros usuarios se crean desde /settings");
}

setup().catch(console.error);