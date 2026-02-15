# 📁 Carpeta Assets - TovalTech Web

**Ubicación:** `/assets/` (raíz del proyecto)

---

## 📋 ARCHIVOS REQUERIDOS

Esta carpeta debe contener los siguientes archivos:

### 1. **Logo Principal**

**Archivo:** `tovaltech.png`
- **Formato:** PNG con transparencia
- **Tamaño recomendado:** 200x60px a 400x120px
- **Uso:** Logo en la navbar del sitio
- **Referencia en código:** `index.html` línea 19

**Estado actual:** ❌ FALTA - Creé un SVG temporal como placeholder

### 2. **Favicon**

**Archivo:** `favicon.ico`
- **Formato:** ICO (multi-resolución recomendado: 16x16, 32x32, 48x48)
- **Uso:** Ícono que aparece en la pestaña del navegador
- **Referencia en código:** `index.html` línea 9

**Estado actual:** ❌ FALTA

### 3. **Audio Troll (Opcional/Easter Egg)**

**Archivo:** `troll.mp3`
- **Formato:** MP3
- **Uso:** Easter egg musical (ver `src/utils/musicTroll.js`)
- **Referencia en código:** `src/utils/musicTroll.js`

**Estado actual:** ❌ FALTA (opcional)

---

## 🔧 ARCHIVOS TEMPORALES CREADOS

Mientras tanto, he creado estos archivos temporales:

### ✅ `tovaltech.svg`
- Logo SVG temporal con el texto "TOVALTECH"
- Degradado azul/morado
- Se puede usar como referencia de diseño

---

## 🎨 CÓMO CREAR LOS ARCHIVOS FALTANTES

### Opción 1: Logo PNG desde SVG

Si te gusta el diseño del SVG temporal:

```bash
# Instalar imagemagick si no lo tienes
sudo apt-get install imagemagick

# Convertir SVG a PNG
convert -background none -density 300 tovaltech.svg -resize 400x120 tovaltech.png
```

O usa una herramienta online:
- https://www.svgtopng.com/
- https://cloudconvert.com/svg-to-png

### Opción 2: Crear Logo Personalizado

Usa herramientas de diseño:
- **Figma** - https://figma.com (gratuito)
- **Canva** - https://canva.com (gratuito)
- **Photoshop** / **GIMP**

**Recomendaciones de diseño:**
- Fondo transparente
- Colores: Azul (#3b82f6) y morado (#8b5cf6) - según tu paleta
- Tipografía: Bold/Black, sans-serif moderna
- Proporción: ~3:1 (ancho:alto)
- Exportar en PNG de alta calidad (300dpi)

### Opción 3: Favicon

**Herramientas online:**
- https://favicon.io/ - Genera favicon desde texto o imagen
- https://realfavicongenerator.net/ - Genera todos los tamaños necesarios

**Desde tu logo:**
```bash
# Si tienes el PNG del logo
convert tovaltech.png -resize 48x48 favicon.ico
```

---

## 📂 ESTRUCTURA FINAL ESPERADA

```
assets/
├── tovaltech.png      ← Logo principal (REQUERIDO)
├── tovaltech.svg      ← Logo SVG (opcional, como backup)
├── favicon.ico        ← Favicon (REQUERIDO)
└── troll.mp3          ← Audio easter egg (opcional)
```

---

## 🔗 REFERENCIAS EN EL CÓDIGO

### index.html
```html
<!-- Línea 9 - Favicon -->
<link rel="icon" href="/assets/favicon.ico" type="image/x-icon" />

<!-- Línea 19 - Logo -->
<img src="/assets/tovaltech.png" 
     onerror="this.style.display='none'; if(this.nextElementSibling){this.nextElementSibling.style.display='inline';}"
     alt="TovalTech" />
```

### src/utils/musicTroll.js
```javascript
// Audio troll (opcional)
const audio = new Audio("/assets/troll.mp3");
```

---

## ⚠️ FALLBACK ACTUAL

**Gracias al código del megapush:**

Si `tovaltech.png` no se encuentra, el logo se oculta y aparece el texto "TovalTech" en su lugar (estilizado con CSS en `.brandText`).

Esto significa que **el sitio funciona sin el PNG**, pero se ve mejor con él.

---

## ✅ CHECKLIST

Antes de hacer el push final, verifica:

- [ ] `tovaltech.png` existe y se ve bien
- [ ] `favicon.ico` existe (probá abriendo una pestaña)
- [ ] Los archivos están en `/assets/` (raíz del proyecto)
- [ ] El logo aparece correctamente en la navbar
- [ ] El favicon aparece en la pestaña del navegador

---

## 🆘 AYUDA

Si necesitas ayuda para crear estos archivos, puedo:
1. Generar más variantes de SVG con diferentes estilos
2. Darte código HTML para previsualizar diseños
3. Recomendarte herramientas específicas

**Archivos críticos:** `tovaltech.png` y `favicon.ico`  
**Archivo opcional:** `troll.mp3` (easter egg)
