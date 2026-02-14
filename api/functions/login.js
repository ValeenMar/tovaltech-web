/**
 * Login endpoint - VERSIÓN SIMPLIFICADA QUE FUNCIONA
 * Primero hacemos que ande, después mejoramos
 */

const { app } = require("@azure/functions");

// Usuarios hardcodeados temporalmente (FASE 1)
// En FASE 2 los movemos a Azure Tables
const USERS = [
  {
    email: "admin@tovaltech.com",
    password: "Milanesa",
    name: "Admin TovalTech",
    role: "admin",
  },
  {
    email: "tobias@tovaltech.com",
    password: "Milanesa",
    name: "Tobias",
    role: "admin",
  },
  {
    email: "vendor@tovaltech.com",
    password: "Milanesa",
    name: "Vendedor Demo",
    role: "vendor",
  },
];

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

      // Buscar usuario
      const user = USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );

      if (!user || user.password !== password) {
        context.log("Login fallido:", email);
        return {
          status: 401,
          jsonBody: {
            success: false,
            message: "Credenciales inválidas",
          },
        };
      }

      // Generar token simple (mejoramos en FASE 2)
      const token = generateSimpleToken({
        email: user.email,
        role: user.role,
        name: user.name,
      });

      context.log("Login exitoso:", email, user.role);

      return {
        status: 200,
        jsonBody: {
          success: true,
          token,
          user: {
            email: user.email,
            name: user.name,
            role: user.role,
          },
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
 * Por ahora sin librería externa para no agregar peso
 */
function generateSimpleToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  
  const data = {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 horas
    iat: Date.now(),
  };
  
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  
  // Firma simple (en FASE 2 usamos crypto)
  const signature = Buffer.from(
    `${header}.${body}.${process.env.JWT_SECRET || "tovaltech-secret"}`
  ).toString("base64url");

  return `${header}.${body}.${signature}`;
}