// File: /src/utils/dataHelpers.js
// Helpers para obtener productos, filtrar, y calcular precios

const API_BASE = '/api';

/**
 * Obtiene productos destacados (nuevos o random sin stock 0)
 */
export async function fetchFeaturedProducts(count = 6) {
  try {
    const res = await fetch(`${API_BASE}/getProducts?page=1&pageSize=500&limit=500`);
    const data = await res.json();
    
    if (!res.ok || !data.ok) {
      throw new Error('API error');
    }
    
    let products = Array.isArray(data.items) ? data.items : [];
    
    // Filtrar sin stock 0
    products = products.filter(p => (p.stock === null || p.stock > 0));
    
    if (products.length === 0) return [];
    
    // Ordenar por updatedAt (más nuevos primero)
    products.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
    
    // Tomar los N más nuevos
    const featured = products.slice(0, count);
    
    // Enriquecer con precio final
    const fx = await getFxUsdArs();
    const margin = getMargin();
    
    return featured.map(p => enrichProduct(p, fx, margin));
    
  } catch (err) {
    console.error('Error fetching featured:', err);
    return [];
  }
}

/**
 * Enriquece un producto con precio final calculado
 */
function enrichProduct(p, fx = 1420, margin = 15) {
  const base = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
  const iva = typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 10.5;
  
  if (base <= 0) {
    return { ...p, finalPrice: null };
  }
  
  const withIva = base * (1 + iva / 100);
  const withMargin = withIva * (1 + margin / 100);
  
  let finalPrice = withMargin;
  
  // Si es USD, convertir a ARS
  const currency = String(p.currency || 'USD').toUpperCase();
  if (currency === 'USD' && fx) {
    finalPrice = withMargin * fx;
  }
  
  return {
    ...p,
    provider: p.providerId || p.provider || null, // Normalizar campo
    finalPrice: Math.round(finalPrice),
    basePriceUsd: base,
    ivaRate: iva,
    marginRate: margin
  };
}

/**
 * Obtiene FX USD->ARS desde API
 */
export async function getFxUsdArs() {
  try {
    const res = await fetch(`${API_BASE}/dollar-rate`, { cache: 'no-store' });
    const data = await res.json();
    
    if (res.ok && data.ok && data.venta) {
      return parseFloat(data.venta);
    }
  } catch (err) {
    console.error('Error fetching FX:', err);
  }
  
  // Fallback
  return 1420;
}

/**
 * Obtiene margen desde localStorage o default
 */
export function getMargin() {
  try {
    const stored = localStorage.getItem('toval_margin_pct');
    const n = parseFloat(stored);
    return (n >= 0 && n <= 100) ? n : 15;
  } catch {
    return 15;
  }
}

/**
 * Guarda margen en localStorage
 */
export function setMargin(value) {
  try {
    const n = parseFloat(value);
    if (n >= 0 && n <= 100) {
      localStorage.setItem('toval_margin_pct', String(n));
      return n;
    }
  } catch {
    // ignore
  }
  return 15;
}

/**
 * Clasifica un producto en categoría
 */
export function classifyProduct(p) {
  const text = `${p.name || ''} ${p.brand || ''} ${p.sku || ''}`.toLowerCase();
  
  const has = (re) => re.test(text);
  
  // Monitores
  if (has(/\bmonitor\b|\bdisplay\b|\bpantalla\b|\blcd\b|\bled\b|\bips\b|\bqhd\b|\bfhd\b|\b4k\b/)) {
    return { cat: 'Monitores', sub: 'Monitores', id: 'monitores' };
  }
  
  // Periféricos
  if (has(/\bteclad(o|os)\b|\bkeyboard\b/)) {
    return { cat: 'Periféricos', sub: 'Teclados', id: 'perifericos' };
  }
  if (has(/\bmouse\b|\brat[oó]n\b/)) {
    return { cat: 'Periféricos', sub: 'Mouse', id: 'perifericos' };
  }
  if (has(/\bheadset\b|\bauricular/)) {
    return { cat: 'Periféricos', sub: 'Audio', id: 'perifericos' };
  }
  
  // Componentes PC
  if (has(/\brtx\b|\bgtx\b|\bradeon\b|\bgpu\b/)) {
    return { cat: 'Componentes PC', sub: 'Placas de video', id: 'componentes' };
  }
  if (has(/\bryzen\b|\bintel\b.*\bcore\b|\bcpu\b/)) {
    return { cat: 'Componentes PC', sub: 'Procesadores', id: 'componentes' };
  }
  if (has(/\bmother\b|\bmainboard\b/)) {
    return { cat: 'Componentes PC', sub: 'Motherboards', id: 'componentes' };
  }
  if (has(/\bddr[345]\b|\bram\b|\bmemoria\b/)) {
    return { cat: 'Componentes PC', sub: 'RAM', id: 'componentes' };
  }
  if (has(/\bnvme\b|\bm\.2\b|\bssd\b/)) {
    return { cat: 'Componentes PC', sub: 'SSD', id: 'componentes' };
  }
  if (has(/\bhdd\b|\bhard drive\b/)) {
    return { cat: 'Componentes PC', sub: 'HDD', id: 'componentes' };
  }
  if (has(/\bpsu\b|\bfuente\b|\bpower supply\b/)) {
    return { cat: 'Componentes PC', sub: 'Fuentes', id: 'componentes' };
  }
  if (has(/\bgabinete\b|\bcase\b/)) {
    return { cat: 'Componentes PC', sub: 'Gabinetes', id: 'componentes' };
  }
  if (has(/\bcooler\b|\bfan\b/)) {
    return { cat: 'Componentes PC', sub: 'Refrigeración', id: 'componentes' };
  }
  
  // Almacenamiento externo
  if (has(/\bpendrive\b|\busb\s?drive\b|\bexternal\b/)) {
    return { cat: 'Almacenamiento', sub: 'Externos', id: 'almacenamiento' };
  }
  
  // Redes
  if (has(/\brouter\b|\bswitch\b|\bwi-?fi\b|\bethernet\b/)) {
    return { cat: 'Networking', sub: 'Redes', id: 'redes' };
  }
  
  // Notebooks
  if (has(/\bnotebook\b|\blaptop\b|\bport[aá]til\b/)) {
    return { cat: 'Notebooks', sub: 'Portátiles', id: 'notebooks' };
  }
  
  return { cat: 'Otros', sub: 'Otros', id: 'otros' };
}

/**
 * Obtiene estadísticas de categorías desde productos
 */
export function getCategoryStats(products) {
  const stats = {};
  
  products.forEach(p => {
    const { id } = classifyProduct(p);
    stats[id] = (stats[id] || 0) + 1;
  });
  
  return stats;
}

/**
 * Formatea precio en ARS
 */
export function formatMoney(amount, currency = 'ARS') {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  
  if (!n || !Number.isFinite(n)) return '-';
  
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString('es-AR')}`;
  }
}
