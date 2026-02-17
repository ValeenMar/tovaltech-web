const { app } = require("@azure/functions");
const { requireUser } = require("../lib/auth");

app.http("me", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request) => {
    const user = requireUser(request);
    if (!user) {
      return {
        status: 401,
        jsonBody: { ok: false, error: "No autenticado" },
      };
    }

    return {
      status: 200,
      jsonBody: {
        ok: true,
        user: {
          email: user.email || user.sub || null,
          name: user.name || null,
          role: user.role || "customer",
        },
      },
    };
  },
});
