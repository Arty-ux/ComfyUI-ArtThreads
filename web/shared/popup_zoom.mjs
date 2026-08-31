// Shared: canvas-zoom-aware popup placement for node pickers.

import { app } from "/scripts/app.js";

export const POPUP_BASE_FONT_PX = 12;
export const POPUP_ZOOM_MIN = 1;
export const POPUP_ZOOM_MAX = 2.5;

export function popupZoom() {
  const s = Number(app.canvas?.ds?.scale);
  if (!isFinite(s) || s <= 0) return 1;
  return Math.min(POPUP_ZOOM_MAX, Math.max(POPUP_ZOOM_MIN, s));
}

export function applyPopupZoom(pop, opts = {}) {
  const zoom = popupZoom();
  const base = opts.baseFontPx || POPUP_BASE_FONT_PX;
  pop.style.fontSize = Math.round(base * zoom * 10) / 10 + "px";
  if (opts.baseMaxHeightPx) {
    if (zoom > 1) {
      const vh = opts.maxHeightVh == null ? 0.6 : opts.maxHeightVh;
      pop.style.maxHeight =
        Math.round(Math.min(opts.baseMaxHeightPx * zoom, window.innerHeight * vh)) + "px";
    } else {
      pop.style.maxHeight = "";
    }
  }
  return zoom;
}

export function placeZoomedPopup(pop, anchorEl, opts = {}) {
  const zoom = applyPopupZoom(pop, opts);

  const r = anchorEl.getBoundingClientRect();
  const margin = opts.margin == null ? 8 : opts.margin;
  const gap = opts.gap == null ? 4 : opts.gap;

  const maxW = opts.baseMaxWidthPx
    ? Math.min(Math.round(window.innerWidth * 0.9), Math.round(opts.baseMaxWidthPx * zoom))
    : Math.round(window.innerWidth * 0.9);
  pop.style.maxWidth = maxW + "px";
  if (opts.anchorWidthIsMin !== false) {
    const wantMin = Math.max(opts.minWidthPx || 200, Math.round(r.width));
    pop.style.minWidth = Math.min(wantMin, maxW) + "px";
  }

  const pw = pop.offsetWidth;
  let left = Math.round(r.left);
  if (left + pw > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - margin - pw);
  pop.style.left = left + "px";

  const h = pop.offsetHeight;
  const below = window.innerHeight - r.bottom;
  pop.style.top = (below < h + margin && r.top > h + margin)
    ? Math.round(r.top - h - gap) + "px"
    : Math.round(r.bottom + gap) + "px";

  return zoom;
}
