/**
 * Script para migrar contraseñas de texto plano a bcrypt
 * Ejecutar una sola vez después del deploy
 */

const { TableClient } = require("@azure/data-tables");
const bcrypt = require("bcrypt");
require("dotenv").config();

const SALT_ROUNDS = 10;

// Usuarios a migrar/crear
const USERS_TO_MIGRATE = [
    {
        email: "valentin@toval-tech.com", // ⚠️ Cambiar por tu email real
        password: "Milanesa", // ⚠️ Esta es la contraseña temporal
        name: "Admin Principal",
        role: "admin",
    },
    {
        email: "tobias@toval-tech.com", // ⚠️ Cambiar por email del socio
        password: "Milanesa", // ⚠️ Contraseña temporal
        name: "Socio",
        role: "admin",
    },
];

function getUsersClient() {
    const conn = process.env.STORAGE_CONNECTION_STRING;
    if (!conn) {
        throw new Error("STORAGE_CONNECTION_STRING no configurado");
    }
    return TableClient.fromConnectionString(conn, "Users");
}

async function migratePassword(client, user) {
    try {
        console.log(`\n🔄 Procesando usuario: ${user.email}`);

        // Hashear contraseña
        const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

        // Verificar si el usuario ya existe
        let existingUser = null;
        try {
            existingUser = await client.getEntity("user", user.email);
            console.log(`   ℹ️  Usuario ya existe, actualizando...`);
        } catch (err) {
            if (err.statusCode === 404) {
                console.log(`   ℹ️  Usuario nuevo, creando...`);
            } else {
                throw err;
            }
        }

        // Crear/actualizar entidad
        const entity = {
            partitionKey: "user",
            rowKey: user.email,
            email: user.email,
            name: user.name,
            role: user.role,
            passwordHash: passwordHash,
            updatedAt: new Date().toISOString(),
        };

        if (existingUser) {
            await client.updateEntity(entity, "Merge");
            console.log(`   ✅ Usuario actualizado con password hasheado`);
        } else {
            await client.createEntity(entity);
            console.log(`   ✅ Usuario creado con password hasheado`);
        }

        // Verificar que el hash funciona
        const isValid = await bcrypt.compare(user.password, passwordHash);
        console.log(`   🔐 Verificación de hash: ${isValid ? "✅ OK" : "❌ FALLÓ"}`);

    } catch (error) {
        console.error(`   ❌ Error procesando ${user.email}:`, error.message);
        throw error;
    }
}

async function main() {
    console.log("🚀 Iniciando migración de contraseñas a bcrypt\n");
    console.log("=".repeat(60));

    try {
        const client = getUsersClient();
        console.log("✅ Conexión a Azure Table Storage establecida");

        // Migrar cada usuario
        for (const user of USERS_TO_MIGRATE) {
            await migratePassword(client, user);
        }

        console.log("\n" + "=".repeat(60));
        console.log("✅ Migración completada exitosamente");
        console.log("\n⚠️  IMPORTANTE:");
        console.log("   1. Cambiá las contraseñas desde la UI después del deploy");
        console.log("   2. Las contraseñas temporales están en este script");
        console.log("   3. No compartir este script con nadie");

    } catch (error) {
        console.error("\n❌ Error en la migración:", error);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = { migratePassword };
