/**
 * Middleware de autenticación con JWT REAL
 * Reemplaza el "fake-jwt-token-tovaltech"
 */

const crypto = require("crypto");
const logger = require("../utils/logger");

// JWT casero (sin dependencias). Requiere JWT_SECRET configurado.
const JWT_SECRET = process.env.JWT_SECRET || null;
const JWT_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Genera un JWT simple (Header.Payload.Signature)
 */
function generateToken(payload) {
  if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }

  const header = { alg: "HS256", typ: "JWT" };
  const exp = Date.now() + JWT_EXPIRY;
  
  const data = {
    ...payload,
    exp,
    iat: Date.now(),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(data));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifica y decodifica un JWT
 */
function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }

  if (!token) throw new Error("No token provided");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const [encodedHeader, encodedPayload, signature] = parts;

  // Verificar firma
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (signature !== expectedSignature) {
    throw new Error("Invalid signature");
  }

  // Decodificar payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  // Verificar expiración
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error("Token expired");
  }

  return payload;
}

/**
 * Middleware: Requiere autenticación válida
 */
async function requireAuth(request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    logger.warn("Auth failed: No token", { url: request.url });
    return { authenticated: false, error: "No token provided" };
  }

  try {
    const payload = verifyToken(token);
    logger.debug("Auth success", { userId: payload.userId, role: payload.role });
    return { authenticated: true, user: payload };
  } catch (err) {
    logger.warn("Auth failed: Invalid token", { error: err.message });
    return { authenticated: false, error: err.message };
  }
}

/**
 * Middleware: Requiere rol específico
 */
function requireRole(allowedRoles) {
  return async (request) => {
    const auth = await requireAuth(request);
    
    if (!auth.authenticated) return auth;

    const userRole = auth.user.role;
    if (!allowedRoles.includes(userRole)) {
      logger.warn("Authorization failed", { 
        userId: auth.user.userId, 
        userRole, 
        required: allowedRoles 
      });
      return { authenticated: false, error: "Insufficient permissions" };
    }

    return auth;
  };
}

// Helpers
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf-8");
}

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  requireRole,
};
