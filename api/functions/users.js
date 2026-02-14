/**
 * Gestión de usuarios - CRUD completo
 * Solo accesible por admins
 * 
 * GET    /api/users          - Listar todos los usuarios
 * POST   /api/users          - Crear nuevo usuario
 * PUT    /api/users/:email   - Actualizar usuario
 * DELETE /api/users/:email   - Eliminar usuario
 */

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getUsersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, "Users");
}

/**
 * Verifica token y extrae usuario
 */
function extractUser(request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) return null;

  try {
    // Decodificar token (parte 2 = payload)
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    // Verificar expiración
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware: solo admins
 */
function requireAdmin(request, context) {
  const user = extractUser(request);

  if (!user || user.role !== "admin") {
    context.log("Acceso denegado - no admin:", user?.email);
    return {
      status: 403,
      jsonBody: {
        ok: false,
        error: "Acceso denegado. Solo administradores.",
      },
    };
  }

  return { ok: true, user };
}

app.http("users", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  route: "users/{email?}",
  handler: async (request, context) => {
    try {
      const client = getUsersClient();

      // Verificar que sea admin
      const auth = requireAdmin(request, context);
      if (!auth.ok) return auth;

      const method = request.method;
      const emailParam = request.params?.email;

      // ===== GET: Listar usuarios =====
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

        context.log("Usuarios listados por:", auth.user.email);

        return {
          status: 200,
          jsonBody: { ok: true, users },
        };
      }

      // ===== GET: Obtener usuario específico =====
      if (method === "GET" && emailParam) {
        try {
          const entity = await client.getEntity("user", emailParam.toLowerCase());
          
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
            return {
              status: 404,
              jsonBody: { ok: false, error: "Usuario no encontrado" },
            };
          }
          throw err;
        }
      }

      // ===== POST: Crear usuario =====
      if (method === "POST") {
        const body = await request.json();
        const { email, password, name, role } = body;

        // Validaciones
        if (!email || !password) {
          return {
            status: 400,
            jsonBody: { ok: false, error: "Email y password requeridos" },
          };
        }

        const emailLower = email.toLowerCase().trim();

        // Validar email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
          return {
            status: 400,
            jsonBody: { ok: false, error: "Email inválido" },
          };
        }

        // Validar rol
        const validRoles = ["admin", "vendor", "customer"];
        const userRole = role || "customer";
        if (!validRoles.includes(userRole)) {
          return {
            status: 400,
            jsonBody: {
              ok: false,
              error: `Rol inválido. Debe ser: ${validRoles.join(", ")}`,
            },
          };
        }

        // Verificar si ya existe
        try {
          await client.getEntity("user", emailLower);
          return {
            status: 409,
            jsonBody: { ok: false, error: "El usuario ya existe" },
          };
        } catch (err) {
          if (err.statusCode !== 404) throw err;
        }

        // Crear usuario
        const newUser = {
          partitionKey: "user",
          rowKey: emailLower,
          email: emailLower,
          password, // TODO: hashear con bcrypt en Fase 2
          name: name || emailLower.split("@")[0],
          role: userRole,
          createdAt: new Date().toISOString(),
          createdBy: auth.user.email,
        };

        await client.createEntity(newUser);

        context.log("Usuario creado:", emailLower, "por", auth.user.email);

        return {
          status: 201,
          jsonBody: {
            ok: true,
            user: {
              email: newUser.email,
              name: newUser.name,
              role: newUser.role,
            },
          },
        };
      }

      // ===== PUT: Actualizar usuario =====
      if (method === "PUT" && emailParam) {
        const body = await request.json();
        const { name, role, password } = body;

        const emailLower = emailParam.toLowerCase();

        // Obtener usuario actual
        let existing;
        try {
          existing = await client.getEntity("user", emailLower);
        } catch (err) {
          if (err.statusCode === 404) {
            return {
              status: 404,
              jsonBody: { ok: false, error: "Usuario no encontrado" },
            };
          }
          throw err;
        }

        // Actualizar campos
        const updated = {
          ...existing,
          name: name !== undefined ? name : existing.name,
          role: role !== undefined ? role : existing.role,
          password: password !== undefined ? password : existing.password,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.user.email,
        };

        await client.updateEntity(updated, "Merge");

        context.log("Usuario actualizado:", emailLower, "por", auth.user.email);

        return {
          status: 200,
          jsonBody: {
            ok: true,
            user: {
              email: updated.email || emailLower,
              name: updated.name,
              role: updated.role,
            },
          },
        };
      }

      // ===== DELETE: Eliminar usuario =====
      if (method === "DELETE" && emailParam) {
        const emailLower = emailParam.toLowerCase();

        // Prevenir que se elimine a sí mismo
        if (emailLower === auth.user.email) {
          return {
            status: 400,
            jsonBody: { ok: false, error: "No podés eliminarte a vos mismo" },
          };
        }

        try {
          await client.deleteEntity("user", emailLower);
          context.log("Usuario eliminado:", emailLower, "por", auth.user.email);

          return {
            status: 200,
            jsonBody: { ok: true, message: "Usuario eliminado" },
          };
        } catch (err) {
          if (err.statusCode === 404) {
            return {
              status: 404,
              jsonBody: { ok: false, error: "Usuario no encontrado" },
            };
          }
          throw err;
        }
      }

      // Método no soportado
      return {
        status: 405,
        jsonBody: { ok: false, error: "Método no permitido" },
      };
    } catch (error) {
      context.error("Error en /api/users:", error);
      return {
        status: 500,
        jsonBody: { ok: false, error: "Error interno del servidor" },
      };
    }
  },
});