/**
 * Login endpoint con validación segura contra tabla Users
 * Usa bcrypt para hashing de contraseñas y JWT real para tokens
 */

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Joi = require("joi");

// Validación de input con Joi
const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(4).required(), // Min 4 por ahora, cambiar a 8+ en producción
});

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
          context.log("❌ Password incorrecto:", email);
          return {
            status: 401,
            jsonBody: {
              success: false,
              message: "Credenciales inválidas",
            },
          };
        }

        // Generar token JWT seguro
        const token = generateToken({
          email: userEntity.email || email,
          role: userEntity.role || "customer",
          name: userEntity.name || email.split("@")[0],
        });

        context.log("✅ Login exitoso:", email, userEntity.role);

        return {
          status: 200,
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

/**
 * Genera un token JWT seguro usando jsonwebtoken
 */
function generateToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET");
  }

  // Generar JWT con expiración de 24 horas
  return jwt.sign(
    payload,
    secret,
    {
      expiresIn: "24h",
      algorithm: "HS256",
    }
  );
}
