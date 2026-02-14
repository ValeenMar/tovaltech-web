/**
 * Login endpoint con validación contra tabla Users
 * Prioridad: Users table > dominios autorizados > hardcoded
 */

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

// Usuarios hardcoded (solo como fallback legacy)
const FALLBACK_USERS = [
  {
    email: "vendor@ejemplo.com",
    password: "Milanesa",
    name: "Vendedor Demo",
    role: "vendor",
  },
];

// Dominios que tienen acceso admin automático (legacy)
const ADMIN_DOMAINS = ["toval-tech.com"];
const ADMIN_DEFAULT_PASSWORD = "Milanesa";

function getUsersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) return null;
  try {
    return TableClient.fromConnectionString(conn, "Users");
  } catch {
    return null;
  }
}

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { email, password } = body;

      if (!email || !password) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: "Email y password requeridos",
          },
        };
      }

      const emailLower = email.toLowerCase().trim();
      const domain = emailLower.split("@")[1];

      // PRIORIDAD 1: Buscar en tabla Users
      const client = getUsersClient();
      if (client) {
        try {
          const userEntity = await client.getEntity("user", emailLower);
          
          // Verificar password (TODO: bcrypt en producción)
          if (userEntity.password === password) {
            const token = generateToken({
              email: userEntity.email || emailLower,
              role: userEntity.role || "customer",
              name: userEntity.name || emailLower.split("@")[0],
            });

            context.log("✅ Login exitoso (Users table):", emailLower, userEntity.role);

            return {
              status: 200,
              jsonBody: {
                success: true,
                token,
                user: {
                  email: userEntity.email || emailLower,
                  name: userEntity.name || emailLower.split("@")[0],
                  role: userEntity.role || "customer",
                },
              },
            };
          } else {
            context.log("❌ Password incorrecto (Users table):", emailLower);
            return {
              status: 401,
              jsonBody: {
                success: false,
                message: "Credenciales inválidas",
              },
            };
          }
        } catch (err) {
          // Si no existe en tabla Users, seguir con fallbacks
          if (err.statusCode !== 404) {
            context.error("Error al buscar usuario:", err);
          }
        }
      }

      // PRIORIDAD 2: Dominio admin (legacy - solo si no está en Users table)
      if (ADMIN_DOMAINS.includes(domain)) {
        if (password !== ADMIN_DEFAULT_PASSWORD) {
          context.log("❌ Login fallido (admin legacy):", emailLower);
          return {
            status: 401,
            jsonBody: {
              success: false,
              message: "Credenciales inválidas",
            },
          };
        }

        const userName = emailLower.split("@")[0];
        const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

        const token = generateToken({
          email: emailLower,
          role: "admin",
          name: displayName,
        });

        context.log("⚠️ Login exitoso (admin legacy - crear usuario en DB):", emailLower);

        return {
          status: 200,
          jsonBody: {
            success: true,
            token,
            user: {
              email: emailLower,
              name: displayName,
              role: "admin",
            },
          },
        };
      }

      // PRIORIDAD 3: Usuarios hardcoded (legacy)
      const fallbackUser = FALLBACK_USERS.find(
        (u) => u.email.toLowerCase() === emailLower
      );

      if (fallbackUser && fallbackUser.password === password) {
        const token = generateToken({
          email: fallbackUser.email,
          role: fallbackUser.role,
          name: fallbackUser.name,
        });

        context.log("⚠️ Login exitoso (fallback - crear usuario en DB):", emailLower);

        return {
          status: 200,
          jsonBody: {
            success: true,
            token,
            user: {
              email: fallbackUser.email,
              name: fallbackUser.name,
              role: fallbackUser.role,
            },
          },
        };
      }

      // Usuario no autorizado
      context.log("❌ Login fallido (unauthorized):", emailLower);
      return {
        status: 401,
        jsonBody: {
          success: false,
          message: "Usuario no autorizado. Contactá a un administrador.",
        },
      };
    } catch (error) {
      context.error("💥 Error en login:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          message: "Error interno del servidor",
        },
      };
    }
  },
});

/**
 * Genera un token JWT compatible con extractUser()
 */
function generateToken(payload) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const data = {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 horas
    iat: Date.now(),
  };

  // Codificar como base64url (compatible con Buffer.from en users.js)
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(data));

  // Firma simple
  const signature = base64UrlEncode(
    `${headerB64}.${payloadB64}.${process.env.JWT_SECRET || "tovaltech-secret-2025"}`
  );

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Helper: codifica a base64url
 */
function base64UrlEncode(str) {
  const b64 = Buffer.from(str).toString("base64");
  return b64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}