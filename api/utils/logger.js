/**
 * Sistema de logging estructurado
 * Usa console en desarrollo, Application Insights en producción
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  // En producción, Application Insights captura esto automáticamente
  console.log(JSON.stringify(entry));
}

const logger = {
  error: (message, meta) => log("ERROR", message, meta),
  warn: (message, meta) => log("WARN", message, meta),
  info: (message, meta) => log("INFO", message, meta),
  debug: (message, meta) => log("DEBUG", message, meta),
};

module.exports = logger;