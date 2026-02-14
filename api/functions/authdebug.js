const { app } = require("@azure/functions");

function preview(v) {
  if (!v) return null;
  const s = String(v);
  return s.length > 60 ? s.slice(0, 60) + "..." : s;
}

app.http("authdebug", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request) => {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    const custom =
      request.headers.get("x-tovaltech-token") ||
      request.headers.get("x-tt-token") ||
      request.headers.get("x-auth-token");

    const xms = request.headers.get("x-ms-client-principal");

    return {
      status: 200,
      jsonBody: {
        hasAuthorization: !!auth,
        authorizationPreview: preview(auth),
        hasCustomToken: !!custom,
        customTokenPreview: preview(custom),
        hasXMsClientPrincipal: !!xms,
        xMsClientPrincipalPreview: preview(xms),
      },
    };
  },
});
