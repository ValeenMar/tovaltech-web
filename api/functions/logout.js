const { app } = require("@azure/functions");
const { clearSessionCookie } = require("../lib/auth");

app.http("logout", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    return {
      status: 200,
      headers: {
        "Set-Cookie": clearSessionCookie(request),
        "content-type": "application/json",
      },
      jsonBody: { ok: true },
    };
  },
});
