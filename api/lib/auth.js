// File: /api/lib/auth.js
// Auth helper for Azure Functions (SWA-friendly).
// Reads token from: x-tovaltech-token / x-tt-token / x-auth-token / Authorization: Bearer <token>

const crypto = require("crypto");

function stripQuotes(s) {
  const v = String(s || "").trim();
  return v.replace(/^"+|"+$/g, "");
}

function decodeBase64Url(str) {
  let base64 = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) throw new Error("Invalid base64url string");
    base64 += "=".repeat(4 - pad);
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function encodeBase64Url(str) {
  return Buffer.from(String(str), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function getTokenFromRequest(request) {
  const custom =
    request.headers.get("x-tovaltech-token") ||
    request.headers.get("x-tt-token") ||
    request.headers.get("x-auth-token");

  if (custom) return stripQuotes(custom);

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) return null;

  return stripQuotes(String(authHeader).replace(/^Bearer\s+/i, ""));
}

function signJwtHS256(headerB64, payloadB64, secret) {
  // signature = base64url( HMACSHA256( header.payload, secret ) )
  return crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
}

function verifyJwt(token, secret) {
  if (!token) return null;

  const parts = String(token).split(".");
  if (parts.length !== 3) return null;

  const [h, p, sig] = parts;

  // Try strict HS256 first
  try {
    const expected = signJwtHS256(h, p, secret);
    if (sig === expected) {
      const payload = JSON.parse(decodeBase64Url(p));
      if (!payload || typeof payload !== "object") return null;

      // exp is milliseconds epoch
      if (payload.exp && Number(payload.exp) < Date.now()) return null;

      return payload;
    }
  } catch {
    // continue to legacy
  }

  // Legacy fallback (older builds): signature was base64url("h.p.SECRET")
  try {
    const legacyExpected = encodeBase64Url(`${h}.${p}.${secret}`);
    if (sig === legacyExpected) {
      const payload = JSON.parse(decodeBase64Url(p));
      if (!payload || typeof payload !== "object") return null;
      if (payload.exp && Number(payload.exp) < Date.now()) return null;
      return payload;
    }
  } catch {
    // ignore
  }

  return null;
}

function getAuthSecret() {
  return process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || "tovaltech-secret-2025";
}

function requireUser(request) {
  const token = getTokenFromRequest(request);
  const payload = verifyJwt(token, getAuthSecret());
  return payload;
}

function requireAdmin(request) {
  const u = requireUser(request);
  if (!u) return null;
  if (String(u.role || "").toLowerCase() !== "admin") return null;
  return u;
}

function makeJwt(payload) {
  const secret = getAuthSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24h
  };

  const h = encodeBase64Url(JSON.stringify(header));
  const p = encodeBase64Url(JSON.stringify(data));
  const sig = signJwtHS256(h, p, secret);

  return `${h}.${p}.${sig}`;
}

module.exports = {
  getTokenFromRequest,
  verifyJwt,
  requireUser,
  requireAdmin,
  makeJwt,
};
