import { app } from "/scripts/app.js";
import { isVueNodes } from "./nodes2.mjs";

export function getNodeScreenRect(node) {
  if (isVueNodes() && node && node.id != null) {
    const elx = document.querySelector('[data-node-id="' + node.id + '"]');
    if (elx) return elx.getBoundingClientRect();
  }
  const c = app.canvas;
  const ds = c && c.ds;
  const canvasEl = c && c.canvas;
  if (!ds || !canvasEl || !node || !node.pos || !node.size) return null;
  const cr = canvasEl.getBoundingClientRect();
  const titleH = (window.LiteGraph && window.LiteGraph.NODE_TITLE_HEIGHT) || 30;
  const scale = ds.scale || 1;
  const off = ds.offset || [0, 0];
  const left = cr.left + (node.pos[0] + off[0]) * scale;
  const top = cr.top + (node.pos[1] - titleH + off[1]) * scale;
  const width = node.size[0] * scale;
  const height = (node.size[1] + titleH) * scale;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

export function placeBeside(panel, rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = panel.offsetWidth;
  const mh = panel.offsetHeight;
  const gap = 12;
  const pad = 8;
  if (!rect) {
    panel.style.left = Math.max(pad, (vw - mw) / 2) + "px";
    panel.style.top = Math.max(pad, (vh - mh) / 2) + "px";
    return;
  }
  let left = rect.right + gap;
  if (left + mw > vw - pad) left = rect.left - gap - mw;
  if (left < pad) left = Math.max(pad, vw - mw - pad);
  let top = rect.top;
  if (top + mh > vh - pad) top = vh - mh - pad;
  if (top < pad) top = pad;
  panel.style.left = left + "px";
  panel.style.top = top + "px";
}

export function followNode(panel, node, { isCurrent, isUserMoved }) {
  let raf = null;
  let lastScale = null, lastX = null, lastY = null;
  const tick = () => {
    if (!panel.isConnected || (isCurrent && !isCurrent())) { raf = null; return; }
    if ((node.graph || app.graph)?.getNodeById?.(node.id) !== node) { raf = null; return; }
    raf = requestAnimationFrame(tick);
    if (isUserMoved && isUserMoved()) return;
    const ds = app.canvas?.ds;
    if (!ds) return;
    const sc = ds.scale || 1;
    const ox = ds.offset?.[0] ?? 0, oy = ds.offset?.[1] ?? 0;
    if (sc === lastScale && ox === lastX && oy === lastY) return;
    lastScale = sc; lastX = ox; lastY = oy;
    placeBeside(panel, getNodeScreenRect(node));
  };
  raf = requestAnimationFrame(tick);

  let ro = null;
  try {
    ro = new ResizeObserver(() => {
      if (!panel.isConnected || (isCurrent && !isCurrent())) {
        if (ro) { try { ro.disconnect(); } catch (e2) { /* already gone */ } ro = null; }
        return;
      }
      if (isUserMoved && isUserMoved()) return;
      placeBeside(panel, getNodeScreenRect(node));
    });
    ro.observe(panel);
  } catch (e) {
    /* ResizeObserver unavailable */
  }

  return () => {
    if (raf != null) cancelAnimationFrame(raf);
    raf = null;
    if (ro) { try { ro.disconnect(); } catch (e) { /* already gone */ } ro = null; }
  };
}

const DRAG_THRESHOLD = 3;

export function makeDraggable(panel, handle, { onUserMove, ignoreSelector } = {}) {
  handle.addEventListener("pointerdown", (e) => {
    if (ignoreSelector && e.target.closest(ignoreSelector)) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let latched = false;
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    try { handle.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    let done = false;
    const move = (ev) => {
      if (!panel.isConnected) { up(); return; }
      if (!(ev.buttons & 1)) { up(); return; }
      if (!latched) {
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD &&
            Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
        latched = true;
        onUserMove?.();
      }
      panel.style.left =
        Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, ev.clientX - ox)) + "px";
      panel.style.top =
        Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, ev.clientY - oy)) + "px";
    };
    const up = () => {
      if (done) return;
      done = true;
      try { handle.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      handle.removeEventListener("lostpointercapture", up);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    handle.addEventListener("lostpointercapture", up);
  });
}
