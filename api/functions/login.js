const { app } = require('@azure/functions');

app.http('login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json(); // Vital para obtener la password
            const password = body.password;
            const masterPassword = process.env.APP_PASSWORD || "Milanesa";

            if (password === masterPassword) {
                return {
                    status: 200,
                    jsonBody: { success: true, token: "fake-jwt-token-tovaltech" }
                };
            }
            return { status: 401, jsonBody: { success: false, message: "Contraseña incorrecta" } };
        } catch (error) {
            return { status: 400, jsonBody: { success: false, message: "Error en el formato" } };
        }
    }
});