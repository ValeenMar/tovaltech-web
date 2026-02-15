// File: /api/scripts/cleanDuplicates.js
/**
 * Script para eliminar productos duplicados por nombre
 * Uso: node cleanDuplicates.js
 */

const { TableClient } = require("@azure/data-tables");

async function cleanDuplicates() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PRODUCTS_TABLE_NAME || "Products";
  
  if (!conn) {
    console.error("❌ STORAGE_CONNECTION_STRING no configurado");
    process.exit(1);
  }
  
  console.log("🔍 Conectando a Azure Table Storage...");
  const client = TableClient.fromConnectionString(conn, tableName);
  
  console.log("📥 Cargando todos los productos...");
  
  const products = [];
  for await (const entity of client.listEntities()) {
    products.push({
      partitionKey: entity.partitionKey,
      rowKey: entity.rowKey,
      name: String(entity.name || "").toLowerCase().trim(),
      sku: entity.sku || entity.rowKey,
      providerId: entity.providerId || entity.partitionKey,
      timestamp: entity.timestamp
    });
  }
  
  console.log(`📊 Total de productos: ${products.length}`);
  
  // Agrupar por nombre
  const byName = new Map();
  for (const p of products) {
    if (!p.name) continue;
    
    if (!byName.has(p.name)) {
      byName.set(p.name, []);
    }
    byName.get(p.name).push(p);
  }
  
  // Encontrar duplicados
  const duplicates = [];
  for (const [name, items] of byName) {
    if (items.length > 1) {
      duplicates.push({ name, count: items.length, items });
    }
  }
  
  console.log(`🔍 Grupos duplicados encontrados: ${duplicates.length}`);
  
  if (duplicates.length === 0) {
    console.log("✅ No hay duplicados");
    return;
  }
  
  // Mostrar preview
  console.log("\n📋 Preview de duplicados (primeros 10):");
  duplicates.slice(0, 10).forEach((dup, idx) => {
    console.log(`\n${idx + 1}. "${dup.name}" (${dup.count} copias):`);
    dup.items.forEach((item, i) => {
      console.log(`   ${i + 1}) ${item.providerId}::${item.sku}`);
    });
  });
  
  // Preguntar confirmación
  console.log(`\n⚠️  Se eliminarán ${duplicates.reduce((sum, d) => sum + d.count - 1, 0)} productos duplicados`);
  console.log("   (Se mantiene el más reciente de cada grupo)\n");
  
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    readline.question("¿Continuar? (yes/no): ", resolve);
  });
  readline.close();
  
  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Cancelado");
    return;
  }
  
  // Eliminar duplicados (mantener el más reciente)
  console.log("\n🗑️  Eliminando duplicados...");
  
  let deleted = 0;
  let errors = 0;
  
  for (const dup of duplicates) {
    // Ordenar por timestamp (más reciente primero)
    const sorted = dup.items.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
    
    // Mantener el primero (más reciente), eliminar el resto
    const toDelete = sorted.slice(1);
    
    for (const item of toDelete) {
      try {
        await client.deleteEntity(item.partitionKey, item.rowKey);
        deleted++;
        process.stdout.write(`\r🗑️  Eliminados: ${deleted}`);
      } catch (err) {
        errors++;
        console.error(`\n❌ Error eliminando ${item.providerId}::${item.sku}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n\n✅ Limpieza completada:`);
  console.log(`   - Eliminados: ${deleted}`);
  console.log(`   - Errores: ${errors}`);
  console.log(`   - Productos restantes: ${products.length - deleted}`);
}

cleanDuplicates().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
