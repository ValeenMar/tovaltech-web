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
  // Agregá más vendors acá si querés
];

// Dominios que tienen acceso admin automático
const ADMIN_DOMAINS = ["toval-tech.com"];

// Password temporal para @toval-tech.com (cambiar después)
const ADMIN_DEFAULT_PASSWORD = "Milanesa";

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { email, password } = body;

      // Validación básica
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

        const userName = emailLower.split("@")[0]; // "valentin" o "tobias"
        const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

        const token = generateSimpleToken({
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

        const token = generateSimpleToken({
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
 * Genera un token JWT simple
 */
function generateSimpleToken(payload) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");

  const data = {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 horas
    iat: Date.now(),
  };

  const body = Buffer.from(JSON.stringify(data)).toString("base64url");

  const signature = Buffer.from(
    `${header}.${body}.${process.env.JWT_SECRET || "tovaltech-secret-2025"}`
  ).toString("base64url");

  return `${header}.${body}.${signature}`;
}