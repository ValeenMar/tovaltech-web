/**
 * Login endpoint con dominios autorizados
 * @toval-tech.com = admin automático
 */

const { app } = require("@azure/functions");

// Usuarios específicos (vendors, clientes especiales, etc)
const SPECIFIC_USERS = [
  {
    email: "vendor@ejemplo.com",
    password: "Milanesa",
    name: "Vendedor Demo",
    role: "vendor",
  },
];

// Dominios que tienen acceso admin automático
const ADMIN_DOMAINS = ["toval-tech.com"];

// Password temporal para @toval-tech.com
const ADMIN_DEFAULT_PASSWORD = "Milanesa";

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

      // CASO 1: Email de dominio admin (@toval-tech.com)
      if (ADMIN_DOMAINS.includes(domain)) {
        if (password !== ADMIN_DEFAULT_PASSWORD) {
          context.log("Login fallido (admin):", emailLower);
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

        context.log("Login exitoso (admin):", emailLower);

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

      // CASO 2: Usuario específico (vendor, etc)
      const specificUser = SPECIFIC_USERS.find(
        (u) => u.email.toLowerCase() === emailLower
      );

      if (specificUser) {
        if (specificUser.password !== password) {
          context.log("Login fallido (specific):", emailLower);
          return {
            status: 401,
            jsonBody: {
              success: false,
              message: "Credenciales inválidas",
            },
          };
        }

        const token = generateToken({
          email: specificUser.email,
          role: specificUser.role,
          name: specificUser.name,
        });

        context.log("Login exitoso (specific):", emailLower, specificUser.role);

        return {
          status: 200,
          jsonBody: {
            success: true,
            token,
            user: {
              email: specificUser.email,
              name: specificUser.name,
              role: specificUser.role,
            },
          },
        };
      }

      // CASO 3: Usuario no autorizado
      context.log("Login fallido (unauthorized):", emailLower);
      return {
        status: 401,
        jsonBody: {
          success: false,
          message: "Usuario no autorizado. Contactá a un administrador.",
        },
      };
    } catch (error) {
      context.error("Error en login:", error);
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