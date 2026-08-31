import { app } from "/scripts/app.js";

const CANVAS_BACKING_CAP = 6000;

export function canvasBackingScale(cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const zoom = Math.max(1, app.canvas?.ds?.scale || 1);
  let s = dpr * zoom;
  const longCss = Math.max(cssW || 0, cssH || 0);
  if (longCss > 0 && longCss * s > CANVAS_BACKING_CAP) s = CANVAS_BACKING_CAP / longCss;
  return s;
}

export function installZoomRepaint(node, getSize, render, rafKey) {
  void getSize;
  let lastZoom = -1;
  const tick = () => {
    const zoom = Math.max(1, app.canvas?.ds?.scale || 1);
    if (Math.abs(zoom - lastZoom) > 0.005) {
      lastZoom = zoom;
      render();
    }
    node[rafKey] = requestAnimationFrame(tick);
  };
  node[rafKey] = requestAnimationFrame(tick);
  return () => {
    try { cancelAnimationFrame(node[rafKey]); } catch (_e) {}
    node[rafKey] = null;
  };
}

export function isVueNodes() {
  return !!window.LiteGraph?.vueNodesMode;
}

export function applyAdaptiveCanvasOnly(widget) {
  if (!widget?.options) return widget;
  try {
    Object.defineProperty(widget.options, "canvasOnly", {
      configurable: true,
      enumerable: true,
      get() {
        return !window.LiteGraph?.vueNodesMode;
      },
    });
  } catch (_e) {
    widget.options.canvasOnly = !window.LiteGraph?.vueNodesMode;
  }
  return widget;
}
