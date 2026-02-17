// File: /api/lib/auth.js
// Auth helpers con JWT + cookie HttpOnly.

const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "tt_session";

function stripQuotes(s) {
  const v = String(s || "").trim();
  return v.replace(/^"+|"+$/g, "");
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  if (!header) return out;

  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return;
    out[key] = decodeURIComponent(value);
  });

  return out;
}

function getTokenFromRequest(request) {
  const custom =
    request.headers.get("x-tovaltech-token") ||
    request.headers.get("x-tt-token") ||
    request.headers.get("x-auth-token");

  if (custom) return stripQuotes(custom);

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader) {
    return stripQuotes(String(authHeader).replace(/^Bearer\s+/i, ""));
  }

  const cookies = parseCookies(request);
  if (cookies[SESSION_COOKIE]) return stripQuotes(cookies[SESSION_COOKIE]);

  return null;
}

function getAuthSecret() {
  return process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || null;
}

function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

function requireUser(request) {
  const token = getTokenFromRequest(request);
  const secret = getAuthSecret();
  if (!secret) return null;
  return verifyJwt(token, secret);
}

function requireAdmin(request) {
  const u = requireUser(request);
  if (!u) return null;
  if (String(u.role || "").toLowerCase() !== "admin") return null;
  return u;
}

function makeJwt(payload) {
  const secret = getAuthSecret();
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "24h" });
}

function buildSessionCookie(token, request) {
  const maxAge = 24 * 60 * 60;
  const isHttps = String(request.url || "").startsWith("https://") || process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps ? "; Secure" : ""}`;
}

function clearSessionCookie(request) {
  const isHttps = String(request.url || "").startsWith("https://") || process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps ? "; Secure" : ""}`;
}

module.exports = {
  SESSION_COOKIE,
  parseCookies,
  getTokenFromRequest,
  verifyJwt,
  requireUser,
  requireAdmin,
  makeJwt,
  buildSessionCookie,
  clearSessionCookie,
};
