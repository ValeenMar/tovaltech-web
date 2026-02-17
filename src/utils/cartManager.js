/**
 * Cart Manager - Manejo de carrito con localStorage
 * Funciona SIN necesidad de login
 */

const CART_KEY = "toval_cart";
const CART_VERSION = "1.0";

export const CartManager = {
    /**
     * Obtener carrito actual
     */
    getCart() {
        try {
            const data = localStorage.getItem(CART_KEY);
            if (!data) return [];

            const parsed = JSON.parse(data);

            // Verificar version (para futuras migraciones)
            if (parsed.version !== CART_VERSION) {
                return [];
            }

            return Array.isArray(parsed.items) ? parsed.items : [];
        } catch (err) {
            console.error("Error loading cart:", err);
            return [];
        }
    },

    /**
     * Guardar carrito
     */
    saveCart(items) {
        try {
            const data = {
                version: CART_VERSION,
                items,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(CART_KEY, JSON.stringify(data));
            this.updateBadge();
        } catch (err) {
            console.error("Error saving cart:", err);
        }
    },

    /**
     * Agregar producto al carrito
     */
    addItem(product, quantity = 1) {
        const cart = this.getCart();
        const existing = cart.find((item) => item.sku === product.sku);

        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({
                sku: product.sku,
                name: product.name,
                brand: product.brand,
                price: product.price,
                finalPrice: product.finalPrice || product.price,
                currency: product.currency,
                imageUrl: product.imageUrl || product.thumbUrl,
                providerId: product.providerId,
                quantity,
                addedAt: new Date().toISOString(),
            });
        }

        this.saveCart(cart);
        this.showToast(`✅ ${product.name} agregado al carrito`);
    },

    /**
     * Actualizar cantidad de un item
     */
    updateQuantity(sku, quantity) {
        const cart = this.getCart();
        const item = cart.find((i) => i.sku === sku);

        if (item) {
            item.quantity = Math.max(1, quantity);
            this.saveCart(cart);
        }
    },

    /**
     * Remover item del carrito
     */
    removeItem(sku) {
        const cart = this.getCart();
        const filtered = cart.filter((item) => item.sku !== sku);
        this.saveCart(filtered);
        this.showToast("🗑️ Producto eliminado del carrito");
    },

    /**
     * Vaciar carrito
     */
    clearCart() {
        this.saveCart([]);
        this.showToast("🧹 Carrito vaciado");
    },

    /**
     * Obtener total del carrito
     */
    getTotal() {
        const cart = this.getCart();
        return cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    },

    /**
     * Obtener cantidad total de items
     */
    getItemCount() {
        const cart = this.getCart();
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    },

    /**
     * Actualizar badge de cantidad en header
     */
    updateBadge() {
        const count = this.getItemCount();
        const badges = document.querySelectorAll(".cartBadge");

        badges.forEach((badge) => {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = "inline-block";
            } else {
                badge.style.display = "none";
            }
        });
    },

    /**
     * Generar mensaje para WhatsApp
     */
    generateWhatsAppMessage() {
        const cart = this.getCart();
        if (cart.length === 0) {
            return encodeURIComponent("¡Hola! Quiero consultar por productos.");
        }

        const total = this.getTotal();
        let message = "¡Hola! Me interesa cotizar los siguientes productos:\n\n";

        cart.forEach((item, i) => {
            message += `${i + 1}. ${item.name}\n`;
            if (item.brand) message += `   Marca: ${item.brand}\n`;
            message += `   SKU: ${item.sku}\n`;
            message += `   Cantidad: ${item.quantity}\n`;
            message += `   Precio unitario: $${item.finalPrice.toLocaleString("es-AR")}\n`;
            message += `   Subtotal: $${(item.finalPrice * item.quantity).toLocaleString("es-AR")}\n\n`;
        });

        message += `*Total estimado: $${total.toLocaleString("es-AR")}*\n\n`;
        message += "¿Podés confirmarme disponibilidad y precio final?";

        return encodeURIComponent(message);
    },

    /**
     * Abrir WhatsApp con mensaje del carrito
     */
    openWhatsApp() {
        const phone = "5491123413674"; // ARG internacional
        const message = this.generateWhatsAppMessage();
        const url = `https://wa.me/${phone}?text=${message}`;
        window.open(url, "_blank");
    },

    /**
     * Mostrar toast notification
     */
    showToast(message, duration = 3000) {
        // Buscar o crear toast container
        let container = document.querySelector(".toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.className = "toastContainer";
            document.body.appendChild(container);
        }

        // Crear toast
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        container.appendChild(toast);

        // Animación de entrada
        setTimeout(() => toast.classList.add("show"), 10);

        // Remover después de duration
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Inicializar (llamar al cargar página)
     */
    init() {
        this.updateBadge();
    },
};

// Auto-init cuando se carga el módulo
if (typeof window !== "undefined") {
    CartManager.init();
}
