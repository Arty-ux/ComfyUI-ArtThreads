// ArtThreads inline color picker — swatch grid + native hex input.

import { BRAND } from "./node_settings.mjs";

export const ARTTHREADS_PALETTE = [
  "#ffffff", "#e6e6e6", "#cccccc", "#b3b3b3", "#999999", "#808080",
  "#666666", "#4d4d4d", "#333333", "#1a1a1a", "#0a0a0a", "#000000",
  "#ff5555", "#ff8c42", "#ffd166", "#a3e635", "#4ade80", "#22d3ee",
  "#5a8cff", "#818cf8", "#c075f6", "#f472b6", "#ec4899", "#5b8def",
  "#7c2d12", "#a16207", "#65a30d", "#0e7490", "#1e40af", "#581c87",
  "#a16d3a", "#b08968", "#ddb892", "#a07e6a", "#5a4634", "#2c2620",
];

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function normHex(v, fallback) {
  const m = /^#?([\da-f]{6})$/i.exec(String(v || "").trim());
  return m ? ("#" + m[1].toLowerCase()) : fallback;
}

export function createArtThreadsColorPicker({ initialColor, resetColor, onChange } = {}) {
  let color = normHex(initialColor, resetColor || BRAND);
  const root = el("div", "at-cp");
  root.style.cssText = "display:flex;flex-direction:column;gap:8px;";

  const grid = el("div", "at-cp-grid");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(12,1fr);gap:4px;";
  root.appendChild(grid);

  const paintGrid = () => {
    grid.innerHTML = "";
    for (const c of ARTTHREADS_PALETTE) {
      const sw = el("button", "at-cp-sw");
      sw.type = "button";
      sw.title = c;
      sw.style.cssText = `width:100%;aspect-ratio:1;border:1px solid #444;border-radius:3px;background:${c};cursor:pointer;padding:0;`;
      if (c.toLowerCase() === color.toLowerCase()) sw.style.outline = `2px solid ${BRAND}`;
      sw.onclick = (e) => {
        e.stopPropagation();
        color = c;
        hex.value = c;
        onChange?.(c);
        paintGrid();
      };
      grid.appendChild(sw);
    }
  };

  const row = el("div", "at-cp-row");
  row.style.cssText = "display:flex;gap:8px;align-items:center;";
  const hex = el("input", "at-cp-hex");
  hex.type = "text";
  hex.value = color;
  hex.style.cssText = "flex:1;background:#1d1d1d;border:1px solid #444;border-radius:4px;color:#e0e0e0;padding:5px 8px;font:12px monospace;";
  hex.addEventListener("keydown", (e) => e.stopPropagation());
  hex.onchange = () => {
    color = normHex(hex.value, color);
    hex.value = color;
    onChange?.(color);
    paintGrid();
  };
  const reset = el("button", "at-cp-reset");
  reset.type = "button";
  reset.textContent = "Reset";
  reset.style.cssText = "border:1px solid #444;background:rgba(255,255,255,.04);color:#ccc;border-radius:4px;padding:5px 10px;cursor:pointer;font:12px sans-serif;";
  reset.onclick = (e) => {
    e.stopPropagation();
    color = resetColor || BRAND;
    hex.value = color;
    onChange?.(color);
    paintGrid();
  };
  row.appendChild(hex);
  row.appendChild(reset);
  root.appendChild(row);
  paintGrid();

  return {
    element: root,
    getColor: () => color,
    setColor: (v) => {
      color = normHex(v, color);
      hex.value = color;
      paintGrid();
    },
    destroy: () => { root.remove(); },
  };
}
