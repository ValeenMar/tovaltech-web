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

function decodeBase64Url(str) {
  let base64 = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) throw new Error("Invalid base64url string");
    base64 += "=".repeat(4 - pad);
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function stripQuotes(s) {
  const v = String(s || "").trim();
  return v.replace(/^"+|"+$/g, "");
}

/**
 * SWA puede ignorar/sobrescribir Authorization.
 * Preferimos un header custom para el token.
 */
function getTokenFromRequest(request, context) {
  // 1) Header custom (recomendado)
  const custom =
    request.headers.get("x-tovaltech-token") ||
    request.headers.get("x-tt-token") ||
    request.headers.get("x-auth-token");

  if (custom) return stripQuotes(custom);

  // 2) Authorization (fallback: local / otros hosts)
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (auth) {
    const token = auth.replace(/^bearer\s+/i, "");
    return stripQuotes(token);
  }

  // 3) Query param (solo para debug puntual)
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("token");
    if (q) return stripQuotes(q);
  } catch {
    // ignore
  }

  context?.log?.("No auth token found in headers");
  return null;
}

function extractUser(request, context) {
  const token = getTokenFromRequest(request, context);
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      context?.log?.("Invalid token format - expected 3 parts, got", parts.length);
      return null;
    }

    const payloadJson = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() > payload.exp) {
      context?.log?.("Token expired");
      return null;
    }

    return payload;
  } catch (err) {
    context?.error?.("Error decodificando token:", err?.message || err);
    return null;
  }
}

function requireAdmin(request, context) {
  const user = extractUser(request, context);

  context?.log?.("Auth check:", {
    hasUser: !!user,
    userEmail: user?.email,
    userRole: user?.role,
  });

  if (!user) {
    return {
      status: 403,
      jsonBody: {
        ok: false,
        error: "No autenticado.\nPor favor ingresá de nuevo.",
      },
    };
  }

  if (user.role !== "admin") {
    return {
      status: 403,
      jsonBody: {
        ok: false,
        error: `Acceso denegado. Tu rol es: ${user.role}.\nSe requiere: admin.`,
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
      const auth = requireAdmin(request, context);
      if (!auth.ok) return auth;

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

        const newUser = {
          partitionKey: "user",
          rowKey: emailLower,
          email: emailLower,
          password, // TODO: bcrypt
          name: name || emailLower.split("@")[0],
          role: userRole,
          createdAt: new Date().toISOString(),
          createdBy: auth.user.email,
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

        const updated = {
          ...existing,
          name: name !== undefined ? name : existing.name,
          role: role !== undefined ? role : existing.role,
          password: password !== undefined ? password : existing.password,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.user.email,
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

        if (emailLower === auth.user.email) {
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
