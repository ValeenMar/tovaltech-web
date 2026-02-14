/**
 * Script para crear tabla Users
 * Ejecutar: node api/scripts/createUsersTable.js
 */

const { TableClient } = require("@azure/data-tables");

// Cargar variables de entorno si existe .env
try {
  require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
} catch {
  // No hay dotenv, usar variables de sistema
}

async function setup() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  
  if (!conn) {
    console.error("\n❌ ERROR: STORAGE_CONNECTION_STRING no está configurado\n");
    console.log("Opciones para configurarlo:\n");
    console.log("1) Crear archivo api/.env con:");
    console.log("   STORAGE_CONNECTION_STRING=tu_connection_string\n");
    console.log("2) O ejecutar:");
    console.log('   $env:STORAGE_CONNECTION_STRING = "tu_connection_string"');
    console.log("   node api/scripts/createUsersTable.js\n");
    process.exit(1);
  }

  try {
    const client = TableClient.fromConnectionString(conn, "Users");

    // Crear tabla
    console.log("⏳ Creando tabla Users...");
    try {
      await client.createTable();
      console.log("✅ Tabla Users creada exitosamente");
    } catch (err) {
      if (err.statusCode === 409) {
        console.log("ℹ️  Tabla Users ya existe (ok)");
      } else {
        throw err;
      }
    }

    console.log("\n🎉 Setup completo!\n");
    console.log("💡 Usuarios @toval-tech.com tienen acceso admin automático");
    console.log("💡 Otros usuarios se crean desde /settings\n");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nVerificá que el connection string sea correcto.\n");
    process.exit(1);
  }
}

setup();