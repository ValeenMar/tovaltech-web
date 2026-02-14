/**
 * Endpoint de autenticación
 * POST /api/login
 * Body: { email, password }
 * Returns: { ok: true, token: "jwt...", user: {...} }
 */

const { app } = require("@azure/functions");
const { generateToken } = require("../middleware/auth");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { isValidEmail } = require("../utils/validators");
const logger = require("../utils/logger");
const { TableClient } = require("@azure/data-tables");

// Conectar a tabla de usuarios
function getUsersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, "Users");
}

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: asyncHandler(async (request, context) => {
    const body = await request.json();
    const { email, password } = body;

    // Validaciones básicas
    if (!email || !password) {
      throw new AppError("Email and password required", 400, "MISSING_CREDENTIALS");
    }

    if (!isValidEmail(email)) {
      throw new AppError("Invalid email format", 400, "INVALID_EMAIL");
    }

    // Buscar usuario en tabla
    const client = getUsersClient();
    let user;

    try {
      // PartitionKey = "user", RowKey = email
      user = await client.getEntity("user", email.toLowerCase());
    } catch (err) {
      if (err.statusCode === 404) {
        logger.warn("Login attempt - user not found", { email });
        throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
      }
      throw err;
    }

    // Verificar password (en producción usarías bcrypt)
    // Por ahora comparación directa (CAMBIAR EN FASE 2)
    if (user.password !== password) {
      logger.warn("Login attempt - wrong password", { email });
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    // Generar JWT
    const token = generateToken({
      userId: user.rowKey,
      email: user.email || email,
      role: user.role || "customer",
      name: user.name || email.split("@")[0],
    });

    logger.info("Login successful", { userId: user.rowKey, role: user.role });

    return {
      status: 200,
      jsonBody: {
        ok: true,
        token,
        user: {
          id: user.rowKey,
          email: user.email || email,
          name: user.name || "",
          role: user.role || "customer",
        },
      },
    };
  }),
});