/**
 * Validadores de datos
 * Evita código repetido de validación
 */

const { toNumber } = require('./formatters');

/**
 * Valida que un SKU sea válido
 */
function isValidSKU(sku) {
  if (!sku) return false;
  const s = String(sku).trim();
  return s.length >= 3 && s.length <= 100;
}

/**
 * Valida email
 */
function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Valida que un precio sea válido (> 0)
 */
function isValidPrice(price) {
  const n = toNumber(price);
  return n !== null && n > 0;
}

/**
 * Valida CUIT/CUIL argentino
 */
function isValidCUIT(cuit) {
  if (!cuit) return false;
  const cleaned = String(cuit).replace(/[-\s]/g, "");
  
  if (!/^\d{11}$/.test(cleaned)) return false;

  // Algoritmo de verificación CUIT
  const [check, ...rest] = cleaned.split("").map(Number).reverse();
  const mult = [2, 3, 4, 5, 6, 7];
  
  const sum = rest.reduce((acc, digit, i) => {
    return acc + digit * mult[i % mult.length];
  }, 0);

  const calculated = 11 - (sum % 11);
  const expected = calculated === 11 ? 0 : calculated === 10 ? 9 : calculated;

  return check === expected;
}

/**
 * Sanitiza input de usuario (previene XSS básico)
 */
function sanitizeString(str, maxLength = 500) {
  if (!str) return "";
  
  return String(str)
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ""); // Básico - en frontend usarás DOMPurify
}

module.exports = {
  isValidSKU,
  isValidEmail,
  isValidPrice,
  isValidCUIT,
  sanitizeString,
};