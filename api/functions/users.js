/**
 * Gestión de usuarios - CRUD completo
 * Solo accesible por admins
 */
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const bcrypt = require("bcrypt");
const { requireAdmin } = require("../lib/auth");

const SALT_ROUNDS = 10;

function getUsersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, "Users");
}

app.http("users", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  route: "users/{email?}",
  handler: async (request, context) => {
    try {
      const client = getUsersClient();
      const authUser = requireAdmin(request);
      if (!authUser) {
        return {
          status: 403,
          jsonBody: { ok: false, error: "Acceso denegado. Se requiere admin." },
        };
      }

      const method = request.method;
      const emailParam = request.params?.email;

      // GET: listar usuarios
      if (method === "GET" && !emailParam) {
        const users = [];
        const iter = client.listEntities({
          queryOptions: { filter: "PartitionKey eq 'user'" },
        });

        for await (const entity of iter) {
          users.push({
            email: entity.rowKey,
            name: entity.name || "",
            role: entity.role || "customer",
            createdAt: entity.createdAt || null,
            createdBy: entity.createdBy || null,
          });
        }

        users.sort((a, b) => a.email.localeCompare(b.email));
        return { status: 200, jsonBody: { ok: true, users } };
      }

      // GET: un usuario
      if (method === "GET" && emailParam) {
        const emailLower = emailParam.toLowerCase();
        try {
          const entity = await client.getEntity("user", emailLower);
          return {
            status: 200,
            jsonBody: {
              ok: true,
              user: {
                email: entity.rowKey,
                name: entity.name || "",
                role: entity.role || "customer",
                createdAt: entity.createdAt || null,
              },
            },
          };
        } catch (err) {
          if (err.statusCode === 404) {
            return { status: 404, jsonBody: { ok: false, error: "Usuario no encontrado" } };
          }
          throw err;
        }
      }

      // POST: crear usuario
      if (method === "POST") {
        const body = await request.json();
        const { email, password, name, role } = body || {};

        if (!email || !password) {
          return { status: 400, jsonBody: { ok: false, error: "Email y password requeridos" } };
        }

        const emailLower = String(email).toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
          return { status: 400, jsonBody: { ok: false, error: "Email inválido" } };
        }

        const validRoles = ["admin", "vendor", "customer"];
        const userRole = role || "customer";
        if (!validRoles.includes(userRole)) {
          return {
            status: 400,
            jsonBody: { ok: false, error: `Rol inválido.\nDebe ser: ${validRoles.join(", ")}` },
          };
        }

        // exists?
        try {
          await client.getEntity("user", emailLower);
          return { status: 409, jsonBody: { ok: false, error: "El usuario ya existe" } };
        } catch (err) {
          if (err.statusCode !== 404) throw err;
        }

        // Hashear password con bcrypt
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const newUser = {
          partitionKey: "user",
          rowKey: emailLower,
          email: emailLower,
          passwordHash, // ✅ Ahora usa bcrypt
          name: name || emailLower.split("@")[0],
          role: userRole,
          createdAt: new Date().toISOString(),
          createdBy: authUser.email,
        };

        await client.createEntity(newUser);

        return {
          status: 201,
          jsonBody: {
            ok: true,
            user: { email: newUser.email, name: newUser.name, role: newUser.role },
          },
        };
      }

      // PUT: update usuario
      if (method === "PUT" && emailParam) {
        const emailLower = emailParam.toLowerCase();
        const body = await request.json();
        const { name, role, password } = body || {};

        let existing;
        try {
          existing = await client.getEntity("user", emailLower);
        } catch (err) {
          if (err.statusCode === 404) {
            return { status: 404, jsonBody: { ok: false, error: "Usuario no encontrado" } };
          }
          throw err;
        }

        // Si se está cambiando password, hashear
        let passwordHash = existing.passwordHash;
        if (password !== undefined) {
          passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        }

        const updated = {
          ...existing,
          name: name !== undefined ? name : existing.name,
          role: role !== undefined ? role : existing.role,
          passwordHash, // ✅ Ahora hasheado
          updatedAt: new Date().toISOString(),
          updatedBy: authUser.email,
        };

        await client.updateEntity(updated, "Merge");

        return {
          status: 200,
          jsonBody: {
            ok: true,
            user: {
              email: updated.email || emailLower,
              name: updated.name || "",
              role: updated.role || "customer",
            },
          },
        };
      }

      // DELETE: borrar usuario
      if (method === "DELETE" && emailParam) {
        const emailLower = emailParam.toLowerCase();

        if (emailLower === authUser.email) {
          return { status: 400, jsonBody: { ok: false, error: "No podés eliminarte a vos mismo" } };
        }

        try {
          await client.deleteEntity("user", emailLower);
          return { status: 200, jsonBody: { ok: true, message: "Usuario eliminado" } };
        } catch (err) {
          if (err.statusCode === 404) {
            return { status: 404, jsonBody: { ok: false, error: "Usuario no encontrado" } };
          }
          throw err;
        }
      }

      return { status: 405, jsonBody: { ok: false, error: "Método no permitido" } };
    } catch (error) {
      context?.error?.("Error en /api/users:", error);
      return { status: 500, jsonBody: { ok: false, error: "Error interno del servidor" } };
    }
  },
});
