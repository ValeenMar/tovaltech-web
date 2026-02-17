/**
 * Login endpoint con validación segura contra tabla Users
 * Usa bcrypt para hashing de contraseñas y JWT real para tokens
 */

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { makeJwt, buildSessionCookie } = require("../lib/auth");

// Validación de input con Joi
const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(4).required(), // Min 4 por ahora, cambiar a 8+ en producción
});

const LOGIN_ATTEMPTS = new Map();
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILS = 8;

function getClientIp(request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || request.headers.get("x-client-ip") || "unknown";
}

function isRateLimited(key) {
  const now = Date.now();
  const rec = LOGIN_ATTEMPTS.get(key);
  if (!rec) return false;
  if (now - rec.at > LOGIN_WINDOW_MS) {
    LOGIN_ATTEMPTS.delete(key);
    return false;
  }
  return rec.fails >= LOGIN_MAX_FAILS;
}

function markFail(key) {
  const now = Date.now();
  const rec = LOGIN_ATTEMPTS.get(key);
  if (!rec || now - rec.at > LOGIN_WINDOW_MS) {
    LOGIN_ATTEMPTS.set(key, { fails: 1, at: now });
    return;
  }
  rec.fails += 1;
  rec.at = now;
}

function clearFails(key) {
  LOGIN_ATTEMPTS.delete(key);
}

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

      // Validar input con Joi
      const { error, value } = loginSchema.validate(body);
      if (error) {
        context.log("❌ Validación fallida:", error.details[0].message);
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: error.details[0].message,
          },
        };
      }

      const { email, password } = value;
      const ip = getClientIp(request);
      const limiterKey = `${ip}|${email}`;

      if (isRateLimited(limiterKey)) {
        return {
          status: 429,
          jsonBody: { success: false, message: "Demasiados intentos. Probá más tarde." },
        };
      }

      // Buscar usuario en tabla Users (única fuente de verdad)
      const client = getUsersClient();
      if (!client) {
        context.error("❌ No se pudo conectar a la tabla Users");
        return {
          status: 500,
          jsonBody: {
            success: false,
            message: "Error de configuración del servidor",
          },
        };
      }

      try {
        const userEntity = await client.getEntity("user", email);

        // Verificar password con bcrypt
        const isPasswordValid = await bcrypt.compare(password, userEntity.passwordHash);

        if (!isPasswordValid) {
          markFail(limiterKey);
          context.log("❌ Password incorrecto:", email);
          return {
            status: 401,
            jsonBody: {
              success: false,
              message: "Credenciales inválidas",
            },
          };
        }

        // Generar token de sesión
        const token = makeJwt({
          email: userEntity.email || email,
          role: userEntity.role || "customer",
          name: userEntity.name || email.split("@")[0],
        });

        const setCookie = buildSessionCookie(token, request);
        clearFails(limiterKey);

        context.log("✅ Login exitoso:", email, userEntity.role);

        return {
          status: 200,
          headers: {
            "Set-Cookie": setCookie,
            "content-type": "application/json",
          },
          jsonBody: {
            success: true,
            token,
            user: {
              email: userEntity.email || email,
              name: userEntity.name || email.split("@")[0],
              role: userEntity.role || "customer",
            },
          },
        };

      } catch (err) {
        // Usuario no encontrado
        if (err.statusCode === 404) {
          markFail(limiterKey);
          context.log("❌ Usuario no encontrado:", email);
          return {
            status: 401,
            jsonBody: {
              success: false,
              message: "Credenciales inválidas",
            },
          };
        }

        // Otro error
        context.error("Error al buscar usuario:", err);
        throw err;
      }

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
