/**
 * Manejo centralizado de errores
 * Todos los endpoints usan esto en lugar de try/catch repetido
 */

const logger = require("../utils/logger");

class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Errores esperados vs bugs
  }
}

/**
 * Wrapper para handlers de Azure Functions
 * Maneja errores automáticamente y loguea
 */
function asyncHandler(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      return handleError(error, context);
    }
  };
}

/**
 * Convierte errores en respuestas HTTP apropiadas
 */
function handleError(error, context) {
  // Log del error
  if (error.isOperational) {
    logger.warn("Operational error", {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.error("Unexpected error", {
      message: error.message,
      stack: error.stack,
    });
  }

  // Respuesta al cliente
  const statusCode = error.statusCode || 500;
  const body = {
    ok: false,
    error: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
  };

  // En desarrollo, agregar stack trace
  if (process.env.NODE_ENV !== "production") {
    body.stack = error.stack;
  }

  return {
    status: statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

module.exports = {
  AppError,
  asyncHandler,
  handleError,
};