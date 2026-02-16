// File: /src/components/filtersSidebar.js
// Sidebar de filtros (desktop colapsable + drawer en mobile)

const COLLAPSE_KEY = "tovaltech_filters_collapsed";

export function initFiltersSidebar({
  root = document,
  layoutId = "catalogLayout",
  sidebarId = "filtersSidebar",
  mobileBtnId = "filtersMobileBtn",
  collapseBtnId = "filtersCollapseBtn",
  closeBtnId = "filtersCloseBtn",
  overlayId = "filtersOverlay",
  storageKey = COLLAPSE_KEY,
} = {}) {
  const layout = root.getElementById(layoutId) || root.querySelector(`#${layoutId}`);
  const sidebar = root.getElementById(sidebarId) || root.querySelector(`#${sidebarId}`);
  const mobileBtn = root.getElementById(mobileBtnId) || root.querySelector(`#${mobileBtnId}`);
  const collapseBtn = root.getElementById(collapseBtnId) || root.querySelector(`#${collapseBtnId}`);
  const closeBtn = root.getElementById(closeBtnId) || root.querySelector(`#${closeBtnId}`);
  const overlay = root.getElementById(overlayId) || root.querySelector(`#${overlayId}`);

  if (!layout || !sidebar) return;

  // --- Desktop collapse (persistente) ---
  const applyCollapsed = (collapsed) => {
    layout.classList.toggle("isSidebarCollapsed", !!collapsed);
    sidebar.classList.toggle("isCollapsed", !!collapsed);
    if (collapseBtn) collapseBtn.setAttribute("aria-expanded", String(!collapsed));
  };

  try {
    const saved = localStorage.getItem(storageKey);
    applyCollapsed(saved === "1");
  } catch (_) {}

  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
      const next = !sidebar.classList.contains("isCollapsed");
      applyCollapsed(next);
      try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch (_) {}
    });
  }

  // --- Mobile drawer ---
  const setDrawerOpen = (open) => {
    sidebar.classList.toggle("isOpen", !!open);
    if (overlay) overlay.hidden = !open;
    document.body.classList.toggle("filtersNoScroll", !!open);
    sidebar.setAttribute("aria-hidden", open ? "false" : "true");
  };

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  if (mobileBtn) mobileBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && sidebar.classList.contains("isOpen")) closeDrawer();
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 769px)").matches) closeDrawer();
  });
}
