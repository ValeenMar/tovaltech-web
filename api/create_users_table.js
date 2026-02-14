const { TableServiceClient } = require("@azure/data-tables");

(async () => {
  try {
    const conn = process.env.STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true";
    const svc = TableServiceClient.fromConnectionString(conn);
    await svc.createTable("Users");
    console.log("✅ Tabla 'Users' creada (o ya existía).");
  } catch (err) {
    console.error("❌ Error creando tabla:", err);
    process.exit(1);
  }
})();
