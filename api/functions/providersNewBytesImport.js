// File: /api/functions/providersNewBytesImport.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PRODUCTS_TABLE_NAME || "Products";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let s = String(v).trim().replace(/\s+/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  if (!text) return rows;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

app.http("providersNewBytesImport", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const started = Date.now();

    try {
      const token = process.env.NEWBYTES_TOKEN;
      if (!token) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "NEWBYTES_TOKEN not configured" }
        };
      }

      const url = `https://api.nb.com.ar/v1/priceListCsv/${token}`;
      context.log(`Fetching NewBytes CSV from: ${url}`);

      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 30000);

      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`NewBytes API returned ${res.status}`);

      const csvText = await res.text();
      const rows = parseCsv(csvText);
      if (rows.length < 2) throw new Error("CSV is empty");

      const header = rows[0].map(h => String(h || "").trim().toLowerCase());

      const idx = (name) => {
        const variations = {
          sku: ["sku", "id", "codigo"],
          name: ["name", "nombre", "descripcion"],
          brand: ["brand", "marca"],
          price: ["price", "precio"],
          currency: ["currency", "moneda"],
          stock: ["stock", "cantidad"],
          image: ["image", "imagen"],
          thumbnail: ["thumbnail", "miniatura"]
        };
        const possible = variations[name] || [name];

        for (const variant of possible) {
          const i = header.findIndex(h => h === variant || h.includes(variant));
          if (i >= 0) return i;
        }
        return -1;
      };

      const skuIdx = idx("sku");
      const nameIdx = idx("name");
      const brandIdx = idx("brand");
      const priceIdx = idx("price");
      const currencyIdx = idx("currency");
      const stockIdx = idx("stock");
      const imageIdx = idx("image");
      const thumbIdx = idx("thumbnail");

      if (skuIdx < 0 || nameIdx < 0) {
        throw new Error("CSV missing SKU or name columns");
      }

      const client = getClient();

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let errors = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        try {
          const sku = String(row[skuIdx] || "").trim();
          if (!sku) { skipped++; continue; }

          const name = String(row[nameIdx] || "").trim();
          if (!name) { skipped++; continue; }

          const brand = brandIdx >= 0 ? String(row[brandIdx] || "").trim() : "";
          const price = priceIdx >= 0 ? toNumber(row[priceIdx]) : null;
          const stock = stockIdx >= 0 ? toNumber(row[stockIdx]) : null;

          const imageUrl = imageIdx >= 0 ? String(row[imageIdx] || "").trim() : null;
          const thumbUrl = thumbIdx >= 0 ? String(row[thumbIdx] || "").trim() : null;

          let currency = "USD";
          if (currencyIdx >= 0) {
            const curr = String(row[currencyIdx] || "").trim();
            if (curr === "1" || curr.toLowerCase() === "ars") currency = "ARS";
            if (curr === "2" || curr.toLowerCase() === "usd") currency = "USD";
          }

          const entity = {
            partitionKey: "newbytes",
            rowKey: sku,
            sku,
            providerId: "newbytes",
            name,
            brand: brand || null,
            price,
            currency,
            stock: stock !== null ? stock : 0,
            imageUrl: imageUrl || null,
            thumbUrl: thumbUrl || null,
            ivaRate: 10.5,
            updatedAt: new Date().toISOString(),
            timestamp: new Date()
          };

          try {
            await client.createEntity(entity);
            created++;
          } catch (err) {
            if (err.statusCode === 409) {
              await client.updateEntity(entity, "Replace");
              updated++;
            } else {
              throw err;
            }
          }
        } catch (err) {
          errors.push({ row: i + 1, error: String(err.message) });
          if (errors.length > 100) break;
        }
      }

      const elapsed = ((Date.now() - started) / 1000).toFixed(2);

      return {
        status: 200,
        jsonBody: {
          ok: true,
          provider: "newbytes",
          stats: {
            total: rows.length - 1,
            created,
            updated,
            skipped,
            errors: errors.length
          },
          elapsed: `${elapsed}s`,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      context.error(err);
      return {
        status: 500,
        jsonBody: { ok: false, error: String(err?.message || err) }
      };
    }
  }
});
