import { app } from "/scripts/app.js";
import { isVueNodes } from "./nodes2.mjs";
import { notifyGraphChanged } from "./graph_changed.mjs";

export const ARTTHREADS_JS_VERSION = "0.1.0";

export const BRAND = "#5b8def";
export const ACCENT_VAR = "--at-acc";
export const ACC = `var(${ACCENT_VAR},${BRAND})`;
export const GLOBAL_ACCENT_SETTING = "ArtThreads.Accent.Default";
export const DEFAULT_ACCENT_PROP = "atAccent";

const _defs = new Map();
let _panel = null;
let _panelNode = null;
const CSS_ID = "at-nodeset-css";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    .at-nset { position:fixed; z-index:10010; width:320px; max-width:94vw; background:#1a1a1a;
      border:1px solid #3a3a3a; border-radius:10px; box-shadow:0 18px 50px rgba(0,0,0,0.6);
      color:#d8d8d8; font:12px 'Segoe UI',-apple-system,sans-serif; overflow:hidden;
      max-height:88vh; display:flex; flex-direction:column; }
    .at-nset-t { flex:0 0 auto; display:flex; align-items:center; gap:8px; padding:10px 12px;
      background:#232323; border-bottom:1px solid #333; cursor:grab; user-select:none; }
    .at-nset-t .g { color:${ACC}; }
    .at-nset-t .n { color:${ACC}; font-weight:600; }
    .at-nset-t .x { margin-left:auto; color:#8a8a8a; cursor:pointer; padding:0 4px; }
    .at-nset-t .x:hover { color:#fff; }
    .at-nset-b { padding:14px 12px; display:flex; flex-direction:column; gap:12px;
      overflow-y:auto; min-height:0; }
    .at-nset-optrow { display:flex; align-items:center; gap:10px; }
    .at-nset-optrow.stack { flex-direction:column; align-items:stretch; gap:5px; }
    .at-nset-opttxt .lab { font-size:12px; color:#cfcfcf; }
    .at-nset-opttxt .sub { font-size:11px; color:#8a8a8a; margin-top:2px; }
    .at-nset-ctl { flex:0 0 auto; display:flex; align-items:center; gap:7px; min-width:96px;
      justify-content:space-between; background:#1d1d1d; border:1px solid #444; border-radius:4px;
      padding:5px 8px; cursor:pointer; user-select:none; }
    .at-nset-ctl:hover { border-color:${ACC}; }
    .at-nset-val { color:#ddd; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .at-nset-caret { color:${ACC}; font-size:9px; line-height:1; }
    .at-nset-pop { position:fixed; z-index:10040; background:#1a1a1a; border:1px solid #444;
      border-radius:5px; box-shadow:0 10px 30px rgba(0,0,0,0.6); padding:3px; max-height:50vh; overflow:auto; }
    .at-nset-popitem { padding:6px 12px; font-size:12px; color:#ccc; cursor:pointer; border-radius:3px; }
    .at-nset-popitem:hover { background:#2a2a2a; color:#fff; }
    .at-nset-popitem.on { color:${ACC}; }
    .at-nset-tog { flex:0 0 auto; width:34px; height:18px; border-radius:9px; cursor:pointer;
      background:rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.18); position:relative; }
    .at-nset-tog .knob { position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%;
      background:#bbb; transition:left .1s, background .1s; }
    .at-nset-tog.on { background:${ACC}; border-color:${ACC}; }
    .at-nset-tog.on .knob { left:18px; background:#fff; }
    .at-nset-text { width:100%; box-sizing:border-box; background:#1d1d1d; border:1px solid #444;
      border-radius:4px; padding:6px 8px; color:#e0e0e0; font:12px monospace; outline:none; }
    .at-nset-text:focus { border-color:${ACC}; }
    .at-nset-acc { display:flex; align-items:center; gap:10px; }
    .at-nset-sw { width:34px; height:24px; border-radius:5px; border:1px solid #555; cursor:pointer;
      padding:0; background:transparent; }
    .at-nset-f { flex:0 0 auto; display:flex; gap:8px; padding:10px 12px; border-top:1px solid #333; background:#1f1f1f; }
    .at-nset-btn { border:1px solid #444; background:rgba(255,255,255,0.04); color:#d8d8d8;
      border-radius:5px; padding:5px 12px; font:12px 'Segoe UI',sans-serif; cursor:pointer; }
    .at-nset-btn:hover { border-color:${ACC}; color:#fff; }
    .at-nset-push { margin-left:auto; }
  `;
  document.head.appendChild(s);
}

export function classAccentSetting(comfyClass) {
  const tail = String(comfyClass || "").replace(/^ArtThreads/, "") || "Node";
  return `ArtThreads.${tail}.AccentColor`;
}

function readSetting(id) {
  try {
    const v = app.ui?.settings?.getSettingValue?.(id);
    if (typeof v === "string" && v.trim()) {
      const s = v.trim();
      return /^[0-9a-fA-F]{3,8}$/.test(s) ? "#" + s : s;
    }
  } catch {}
  return null;
}

async function writeSetting(id, value) {
  try {
    await app.ui.settings.setSettingValueAsync(id, value);
    return true;
  } catch {
    return false;
  }
}

export function nodeSetting(id, fallback) {
  try {
    const v = app.ui?.settings?.getSettingValue?.(id);
    if (v !== undefined && v !== null) return v;
  } catch {}
  return fallback;
}

export function setNodeSetting(id, value) {
  return writeSetting(id, value);
}

export function registerNodeSettings(comfyClass, def) {
  if (!comfyClass || !def || typeof def.open !== "function") return;
  _defs.set(comfyClass, { ...def, kind: def.kind || "custom" });
}

export function registerNodeAccent(comfyClass, opts = {}) {
  if (!comfyClass) return;
  _defs.set(comfyClass, {
    kind: "accent",
    rows: Array.isArray(opts.rows) ? opts.rows : [],
    onRowChange: typeof opts.onRowChange === "function" ? opts.onRowChange : null,
    accent: opts.accent !== false,
    title: opts.title || defaultTitle(comfyClass),
    prop: opts.prop || DEFAULT_ACCENT_PROP,
    setting: opts.setting || classAccentSetting(comfyClass),
    swatchLabel: opts.swatchLabel || "Accent colour",
    swatchHint: opts.swatchHint || "This node only.",
    onChange: typeof opts.onChange === "function" ? opts.onChange : null,
    ownMenuItem: !!opts.ownMenuItem,
    menuLabel: opts.menuLabel || null,
    open: (node) => openSettingsPanel(node),
    closeFor: (node) => closeNodeSettingsFor(node),
  });
}

export function getNodeSettings(comfyClass) {
  return comfyClass ? _defs.get(comfyClass) || null : null;
}

function defaultTitle(comfyClass) {
  return String(comfyClass || "")
    .replace(/^ArtThreads/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim() || "Node";
}

export function accentOf(node) {
  if (!node) return BRAND;
  const def = getNodeSettings(node.comfyClass);
  const own = node.properties?.[def?.prop || DEFAULT_ACCENT_PROP];
  if (typeof own === "string" && own.trim()) return own.trim();
  const perClass = readSetting(def?.setting || classAccentSetting(node.comfyClass));
  if (perClass) return perClass;
  return readSetting(GLOBAL_ACCENT_SETTING) || BRAND;
}

export function setNodeAccent(node, hex) {
  if (!node) return;
  if (!node.properties) node.properties = {};
  const prop = getNodeSettings(node.comfyClass)?.prop || DEFAULT_ACCENT_PROP;
  if (hex) node.properties[prop] = hex;
  else delete node.properties[prop];
  notifyGraphChanged();
}

export function applyAccent(el, node) {
  if (el?.style) el.style.setProperty(ACCENT_VAR, accentOf(node));
}

export function installNodeAccent(node, ...els) {
  if (!node) return;
  let keep = (node._atAccentEls ||= []).filter((e) => e?.isConnected);
  for (const e of els) {
    if (e?.style && !keep.includes(e)) keep.push(e);
    applyAccent(e, node);
  }
  node._atAccentEls = keep;
}

export function repaintAccent(node) {
  if (!node) return;
  const a = accentOf(node);
  for (const e of node._atAccentEls || []) {
    if (e?.isConnected) e.style.setProperty(ACCENT_VAR, a);
  }
  try { node.setDirtyCanvas?.(true, true); } catch {}
  try { getNodeSettings(node.comfyClass)?.onChange?.(node); } catch {}
}

function getNodeScreenRect(node) {
  if (isVueNodes() && node?.id != null) {
    const e = document.querySelector(`[data-node-id="${node.id}"]`);
    if (e) return e.getBoundingClientRect();
  }
  const c = app.canvas;
  const ds = c?.ds;
  const cv = c?.canvas;
  if (!ds || !cv || !node?.pos || !node?.size) return null;
  const cr = cv.getBoundingClientRect();
  const titleH = window.LiteGraph?.NODE_TITLE_HEIGHT || 30;
  const sc = ds.scale || 1;
  const off = ds.offset || [0, 0];
  const left = cr.left + (node.pos[0] + off[0]) * sc;
  const top = cr.top + (node.pos[1] - titleH + off[1]) * sc;
  return {
    left, top,
    right: left + node.size[0] * sc,
    bottom: top + (node.size[1] + titleH) * sc,
    width: node.size[0] * sc,
    height: (node.size[1] + titleH) * sc,
  };
}

function placeBeside(panel, rect) {
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

function makeDraggable(panel, handle) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".x")) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    const move = (ev) => {
      panel.style.left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, ev.clientX - ox)) + "px";
      panel.style.top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, ev.clientY - oy)) + "px";
    };
    const up = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
  });
}

let _optionPopupClose = null;
function closeOptionPopup() {
  try { _optionPopupClose?.(); } catch {}
  _optionPopupClose = null;
  try { document.querySelectorAll(".at-nset-pop").forEach((e) => e.remove()); } catch {}
}

function buildComboRow(row, onChange) {
  const wrap = el("div", "at-nset-ctl");
  const val = el("div", "at-nset-val");
  const opts = Array.isArray(row.options) ? row.options : [];
  const cur = () => nodeSetting(row.setting, row.defaultValue);
  const paint = () => { val.textContent = String(cur() ?? ""); };
  paint();
  wrap.append(val, el("span", "at-nset-caret", "▼"));
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    closeOptionPopup();
    const pop = el("div", "at-nset-pop");
    const r = wrap.getBoundingClientRect();
    pop.style.left = r.left + "px";
    pop.style.top = (r.bottom + 3) + "px";
    pop.style.minWidth = r.width + "px";
    for (const o of opts) {
      const it = el("div", "at-nset-popitem" + (String(o) === String(cur()) ? " on" : ""), String(o));
      it.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await setNodeSetting(row.setting, o);
        paint();
        pop.remove();
        onChange?.(row.setting, o);
      });
      pop.appendChild(it);
    }
    document.body.appendChild(pop);
    const close = () => {
      pop.remove();
      document.removeEventListener("pointerdown", away, true);
      if (_optionPopupClose === close) _optionPopupClose = null;
    };
    const away = (ev) => { if (!pop.contains(ev.target)) close(); };
    _optionPopupClose = close;
    setTimeout(() => document.addEventListener("pointerdown", away, true), 0);
  });
  return { wrap, refresh: paint };
}

function buildToggleRow(row, onChange) {
  const cur = () => !!nodeSetting(row.setting, row.defaultValue);
  const tog = el("div", "at-nset-tog" + (cur() ? " on" : ""));
  tog.appendChild(el("span", "knob"));
  tog.addEventListener("click", async (e) => {
    e.stopPropagation();
    const next = !cur();
    await setNodeSetting(row.setting, next);
    tog.classList.toggle("on", next);
    onChange?.(row.setting, next);
  });
  return { wrap: tog };
}

function buildTextRow(row, onChange) {
  const inp = el("input", "at-nset-text");
  inp.type = "text";
  inp.value = String(nodeSetting(row.setting, row.defaultValue) ?? "");
  if (row.placeholder) inp.placeholder = row.placeholder;
  let t = null;
  inp.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      await setNodeSetting(row.setting, inp.value);
      onChange?.(row.setting, inp.value);
    }, 250);
  });
  inp.addEventListener("pointerdown", (e) => e.stopPropagation());
  return { wrap: inp };
}

export function createOptionRows(node, rows, opts = {}) {
  injectCSS();
  const host = el("div");
  const fire = (setting, value) => opts.onChange?.(node, setting, value);
  for (const row of rows || []) {
    if (!row?.setting) continue;
    const line = el("div", "at-nset-optrow");
    const txt = el("div", "at-nset-opttxt");
    txt.appendChild(el("div", "lab", row.label || row.setting));
    if (row.hint) txt.appendChild(el("div", "sub", row.hint));
    let ctl;
    if (row.kind === "toggle") ctl = buildToggleRow(row, fire);
    else if (row.kind === "text") ctl = buildTextRow(row, fire);
    else ctl = buildComboRow(row, fire);
    if (row.kind === "text") {
      line.classList.add("stack");
      line.append(txt, ctl.wrap);
    } else {
      line.append(txt, ctl.wrap);
    }
    host.appendChild(line);
  }
  return host;
}

export function createAccentSection(node, def) {
  const wrap = el("div");
  const sw = el("input", "at-nset-sw");
  sw.type = "color";
  sw.value = accentOf(node);
  sw.addEventListener("input", () => {
    setNodeAccent(node, sw.value);
    repaintAccent(node);
    def.onChange?.(node);
  });
  const row = el("div", "at-nset-acc");
  const txt = el("div");
  txt.appendChild(el("div", "lab", def.swatchLabel || "Accent colour"));
  if (def.swatchHint) txt.appendChild(el("div", "sub", def.swatchHint));
  row.append(sw, txt);
  wrap.appendChild(row);
  return wrap;
}

function outsideClose(e) {
  if (!_panel || _panel.contains(e.target)) return;
  if (e.target.closest?.(".at-nset-pop")) return;
  closeNodeSettingsPanel();
}

function escClose(e) {
  if (e.key === "Escape" && _panel) {
    if (document.querySelector(".at-nset-pop")) return;
    e.stopPropagation();
    closeNodeSettingsPanel();
  }
}

export function closeNodeSettingsPanel() {
  closeOptionPopup();
  if (_panel) {
    try { _panel.remove(); } catch {}
  }
  _panel = null;
  _panelNode = null;
  document.removeEventListener("pointerdown", outsideClose, true);
  document.removeEventListener("keydown", escClose, true);
}

export function closeNodeSettingsFor(node) {
  if (_panelNode === node) closeNodeSettingsPanel();
}

export function openNodeSettings(node) {
  openSettingsPanel(node);
}

function openSettingsPanel(node) {
  const def = getNodeSettings(node?.comfyClass);
  if (!node || !def) return;
  closeNodeSettingsPanel();
  injectCSS();
  _panelNode = node;

  const title = def.title || defaultTitle(node.comfyClass);
  const panel = el("div", "at-nset");
  panel.style.setProperty(ACCENT_VAR, accentOf(node));

  const head = el("div", "at-nset-t");
  head.append(el("span", "g", "⚙"), el("span", "n", title + " settings"));
  const x = el("span", "x", "✕");
  x.addEventListener("click", closeNodeSettingsPanel);
  head.appendChild(x);

  const body = el("div", "at-nset-b");
  if (def.rows?.length) {
    body.appendChild(createOptionRows(node, def.rows, {
      onChange: (n, setting, value) => def.onRowChange?.(n, setting, value),
    }));
  }
  if (def.accent !== false) {
    body.appendChild(createAccentSection(node, def));
  }

  const foot = el("div", "at-nset-f");
  const done = el("button", "at-nset-btn at-nset-push", "Done");
  done.addEventListener("click", closeNodeSettingsPanel);
  foot.appendChild(done);

  panel.append(head, body, foot);
  document.body.appendChild(panel);
  placeBeside(panel, getNodeScreenRect(node));
  makeDraggable(panel, head);

  setTimeout(() => {
    if (!_panel) return;
    document.addEventListener("pointerdown", outsideClose, true);
    document.addEventListener("keydown", escClose, true);
  }, 0);
  _panel = panel;
}
