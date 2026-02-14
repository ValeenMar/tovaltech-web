// File: /api/index.js
const { app } = require("@azure/functions");

// Importante para que el runtime cargue tus endpoints (app.http)
app.setup({ enableHttpStream: true });

require("./functions/login");
require("./functions/chat");
require("./functions/getProducts");
require("./functions/getProviders");
// File: /api/index.js
require("./functions/providersElitImport");
require("./functions/health");
