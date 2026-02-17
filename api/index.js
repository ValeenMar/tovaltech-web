// File: /api/index.js
// Entry point del Azure Functions (programming model v4)
// IMPORTANTE: cada endpoint en /api/functions/*.js debe ser requerido acá para registrarse.

const { app } = require("@azure/functions");

app.setup({ enableHttpStream: true });

require("./functions/login");
require("./functions/logout");
require("./functions/me");
require("./functions/chat");
require("./functions/getProducts");
require("./functions/product");
require("./functions/getProviders");
require("./functions/providersElitImport");
require("./functions/health");
require("./functions/users");

// FX USD→ARS (DolarAPI) - habilita GET /api/dollar-rate
require("./functions/dollarRate");
