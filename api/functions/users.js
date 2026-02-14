/**
 * Gestión de usuarios - CRUD completo
 * Solo accesible por admins
 */

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getUsersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, "Users");
}

/**
 * Decodifica base64url a string
 * Compatible con tokens generados por cualquier método
 */
function decodeBase64Url(str) {
  // Reemplazar caracteres base64url por base64 estándar
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Agregar padding si es necesario
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('Invalid base64url string');
    }
    base64 += '='.repeat(4 - pad);
  }
  
  // Decodificar
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Verifica token y extrae usuario
 */
function extractUser(request, context) {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader) {
    context?.log("No Authorization header");
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  
  if (!token) {
    context?.log("Empty token");
    return null;
  }

  try {
    // Decodificar token (parte 2 = payload)
    const parts = token.split(".");
    if (parts.length !== 3) {
      context?.log("Invalid token format - expected 3 parts, got", parts.length);
      return null;
    }

    const payloadB64 = parts[1];
    
    // Decodificar usando nuestra función compatible
    const payloadJson = decodeBase64Url(payloadB64);
    const payload = JSON.parse(payloadJson);

    context?.log("Token decoded successfully:", {
      email: payload.email,
      role: payload.role,
      exp: payload.exp
    });

    // Verificar expiración
    if (payload.exp && Date.now() > payload.exp) {
      context?.log("Token expired");
      return null;
    }

    return payload;
  } catch (err) {
    context?.error('Error decodificando token:', err.message);
    return null;
  }
}

/**
 * Middleware: solo admins
 */
function requireAdmin(request, context) {
  const user = extractUser(request, context);

  context.log("Auth check:", {
    hasUser: !!user,
    userEmail: user?.email,
    userRole: user?.role,
  });

  if (!user) {
    context.log("❌ No user found in token");
    return {
      status: 403,
      jsonBody: {
        ok: false,
        error: "No autenticado. Por favor ingresá de nuevo.",
      },
    };
  }

  if (user.role !== "admin") {
    context.log("❌ User is not admin:", user.email, user.role);
    return {
      status: 403,
      jsonBody: {
        ok: false,
        error: `Acceso denegado. Tu rol es: ${user.role}. Se requiere: admin.`,
      },
    };
  }

  context.log("✅ Admin access granted:", user.email);
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
          password, // TODO: hashear con bcrypt
          name: name || emailLower.split("@")[0],
          role: userRole,
          createdAt: new Date().toISOString(),
          createdBy: auth.user.email,
        };

        await client.createEntity(newUser);

        context.log("✅ Usuario creado:", emailLower, "por", auth.user.email);

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