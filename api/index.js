// File: /api/index.js
const { app } = require("@azure/functions");

app.setup({ enableHttpStream: true });

require("./functions/login");
require("./functions/chat");
require("./functions/getProducts");
require("./functions/getProviders");
require("./functions/providersElitImport");
require("./functions/health");
require("./functions/users"); // ← NUEVA LÍNEA
require("./functions/providersElitSyncCron");
