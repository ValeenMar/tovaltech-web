// File: /api/functions/cart.js
// API para gestión de carrito de compras
const { app } = require("@azure/functions");

app.http("cart", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "cart",
  handler: async (request, context) => {
    try {
      // El carrito se maneja principalmente en el frontend (localStorage)
      // Esta API es para futuras funcionalidades como guardar carritos de usuarios logueados
      
      if (request.method === "GET") {
        // Placeholder: obtener carrito guardado de usuario
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ok: true,
            message: "Carrito manejado en frontend por ahora"
          })
        };
      }
      
      if (request.method === "POST") {
        // Placeholder: guardar carrito de usuario
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ok: true,
            message: "Carrito guardado"
          })
        };
      }
      
    } catch (err) {
      context.error("Cart error:", err);
      return {
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, error: String(err.message || err) })
      };
    }
  }
});
