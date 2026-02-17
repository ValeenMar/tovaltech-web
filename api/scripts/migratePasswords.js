/**
 * Script SIMPLIFICADO para migrar contraseñas existentes de texto plano a bcrypt
 * Lee la configuración de local.settings.json automáticamente
 */

const { TableClient } = require("@azure/data-tables");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const SALT_ROUNDS = 10;

// Leer local.settings.json
function getConnectionString() {
    try {
        const settingsPath = path.join(__dirname, "..", "local.settings.json");
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        return settings.Values.STORAGE_CONNECTION_STRING;
    } catch (err) {
        console.error("❌ No se pudo leer local.settings.json:", err.message);
        console.log("\nAsegurate de tener api/local.settings.json con:");
        console.log(`{
  "Values": {
    "STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=..."
  }
}`);
        process.exit(1);
    }
}

function getUsersClient() {
    const conn = getConnectionString();
    if (!conn || conn === "UseDevelopmentStorage=true") {
        console.error("❌ STORAGE_CONNECTION_STRING no configurado correctamente en local.settings.json");
        process.exit(1);
    }
    return TableClient.fromConnectionString(conn, "Users");
}

async function migrateExistingUsers() {
    console.log("🚀 Iniciando migración de contraseñas existentes a bcrypt\n");
    console.log("=".repeat(60));

    try {
        const client = getUsersClient();
        console.log("✅ Conexión a Azure Table Storage establecida\n");

        // Listar todos los usuarios
        const users = [];
        const iter = client.listEntities({
            queryOptions: { filter: "PartitionKey eq 'user'" },
        });

        for await (const entity of iter) {
            users.push(entity);
        }

        console.log(`📋 Encontrados ${users.length} usuarios en la tabla\n`);

        if (users.length === 0) {
            console.log("⚠️  No hay usuarios para migrar");
            return;
        }

        // Migrar cada usuario
        let migrated = 0;
        let skipped = 0;

        for (const user of users) {
            const email = user.rowKey || user.email;
            console.log(`\n🔄 Procesando: ${email}`);

            // Si ya tiene passwordHash, skip
            if (user.passwordHash && !user.password) {
                console.log(`   ⏭️  Ya tiene passwordHash, skipping`);
                skipped++;
                continue;
            }

            // Si tiene password en texto plano, migrar
            if (user.password) {
                const plainPassword = user.password;
                const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

                // Actualizar usuario
                const updated = {
                    ...user,
                    passwordHash: passwordHash,
                    // Opcional: remover password viejo para limpieza
                    password: undefined,
                    migratedAt: new Date().toISOString(),
                };

                await client.updateEntity(updated, "Merge");

                // Verificar que funciona
                const isValid = await bcrypt.compare(plainPassword, passwordHash);
                console.log(`   ✅ Migrado exitosamente (verificación: ${isValid ? "✅" : "❌"})`);
                migrated++;
            } else {
                console.log(`   ⚠️  Usuario sin password ni passwordHash`);
                skipped++;
            }
        }

        console.log("\n" + "=".repeat(60));
        console.log("✅ Migración completada");
        console.log(`   📊 Migrados: ${migrated}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   📝 Total: ${users.length}`);

        if (migrated > 0) {
            console.log("\n🎉 Ahora podés loguearte con las mismas contraseñas de antes!");
            console.log("   Las contraseñas están ahora hasheadas con bcrypt.");
        }

    } catch (error) {
        console.error("\n❌ Error en la migración:", error);
        process.exit(1);
    }
}

// Ejecutar
if (require.main === module) {
    migrateExistingUsers();
}

module.exports = { migrateExistingUsers };
