/**
 * Utilidades compartidas para formateo de datos
 * Elimina duplicación en getProducts, providersElitImport, etc.
 */

/**
 * Convierte cualquier formato numérico a Number o null
 * Soporta: "1.234,56" "1,234.56" "1234.56" "1234,56"
 */
function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let s = String(v).trim().replace(/\s+/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Último separador define el decimal
    s = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza moneda a código ISO
 * ELIT usa "2" = USD, "1" = ARS
 */
function normalizeCurrency(v) {
  if (!v) return null;
  const s = String(v).trim().toUpperCase();
  
  // Mapeos especiales de proveedores
  if (s === "2") return "USD";
  if (s === "1") return "ARS";
  
  // Validar que sea una moneda válida (3 letras)
  if (/^[A-Z]{3}$/.test(s)) return s;
  
  return null;
}

/**
 * Convierte string a boolean de forma segura
 */
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === 0) return !!v;
  
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "yes", "y", "si", "sí"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  
  return false;
}

/**
 * Escapa strings para queries OData (Azure Tables)
 */
function escapeODataString(v) {
  return String(v).replace(/'/g, "''");
}

/**
 * Formatea dinero para display
 */
function formatMoney(amount, currency = "USD") {
  const n = toNumber(amount);
  if (n === null) return "-";
  
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Genera slug URL-friendly
 */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  toNumber,
  normalizeCurrency,
  toBool,
  escapeODataString,
  formatMoney,
  slugify,
};