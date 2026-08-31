// Prompt Mentions ArtThreads — Higgsfield-like tray + @ dropdown + chip highlight.

import { ACC, accentOf } from "../shared/node_settings.mjs";
import { placeZoomedPopup } from "../shared/popup_zoom.mjs";
import { notifyGraphChanged } from "../shared/graph_changed.mjs";
import {
  backdropHTML,
  atQueryAt,
  filterAssets,
  canonicalizeText,
  tagFor,
  syncColumns,
  displayLabel,
} from "./core.mjs";
import { discoverAssets, assetKey } from "./discover.mjs";

const ROOT = "at-pm-root";
let _cssDone = false;
let _acEl = null;
let _ac = null;
let _preview = null;

export function injectCSS() {
  if (_cssDone) return;
  _cssDone = true;
  const css = `
  .${ROOT}{
    box-sizing:border-box; width:100%; height:100%; display:flex; flex-direction:column;
    gap:8px; padding:8px; font:12px 'Segoe UI',sans-serif; color:#ddd;
    background:#1a1a1a; border:1px solid #3a3a3a; border-radius:10px;
    overflow:hidden; pointer-events:auto;
  }
  .${ROOT} .tray{
    flex:none; display:flex; flex-wrap:wrap; gap:8px; align-items:center; min-height:44px;
  }
  .${ROOT} .tray .empty{
    color:#777; font-size:11px; line-height:1.35;
  }
  .${ROOT} .thumb{
    position:relative; width:44px; height:44px; border-radius:8px; overflow:hidden;
    border:1px solid #444; background:#111; flex:none; cursor:pointer;
  }
  .${ROOT} .thumb:hover{ border-color:${ACC}; }
  .${ROOT} .thumb img{
    display:block; width:100%; height:100%; object-fit:cover; pointer-events:none;
  }
  .${ROOT} .thumb .ph{
    display:flex; align-items:center; justify-content:center; width:100%; height:100%;
    color:#888; font:700 10px 'Segoe UI',sans-serif; text-align:center; padding:2px;
  }
  .${ROOT} .thumb .badge{
    position:absolute; left:0; bottom:0; background:rgba(0,0,0,0.72);
    color:#eee; padding:1px 4px; font:700 9px sans-serif;
    border-top-right-radius:6px; max-width:100%; overflow:hidden; text-overflow:ellipsis;
  }
  .${ROOT} .editor{
    position:relative; flex:1; min-height:120px; border:1px solid #444; border-radius:8px;
    background:#141414; overflow:hidden;
  }
  .${ROOT} .editor:focus-within{ border-color:${ACC}; }
  .${ROOT} .bd, .${ROOT} .ta{
    position:absolute; inset:0; box-sizing:border-box; margin:0;
    padding:10px 12px; border:0; width:100%; height:100%;
    font:12.5px/1.45 'Segoe UI',sans-serif; white-space:pre-wrap; word-wrap:break-word;
    overflow:auto; scrollbar-gutter:stable;
  }
  .${ROOT} .bd{
    color:#c8c8c8; pointer-events:none; background:transparent;
  }
  .${ROOT} .ta{
    color:transparent; caret-color:#fff; background:transparent; resize:none; outline:none;
  }
  .${ROOT} .ta::placeholder{ color:#666; }
  .${ROOT} .hint{
    flex:none; color:#7a7a7a; font-size:11px; line-height:1.35;
  }
  .at-pm-chip{
    color:#b8f55a; background:rgba(120,200,40,0.18); border-radius:4px;
    padding:0 2px; box-decoration-break:clone; -webkit-box-decoration-break:clone;
  }
  .at-pm-chip.audio{ color:#7ec8ff; background:rgba(80,160,255,0.16); }
  .at-pm-chip.video{ color:#ffb86b; background:rgba(255,160,60,0.16); }

  .at-pm-ac{
    position:fixed; z-index:10950; display:none; background:#1d1d1d; border:1px solid #4a4a4a;
    border-radius:8px; overflow-y:auto; max-height:260px; min-width:280px;
    box-shadow:0 12px 30px rgba(0,0,0,.6); font:12px 'Segoe UI',sans-serif;
  }
  .at-pm-ac .h{
    padding:5px 11px 3px; font:600 9.5px 'Segoe UI',sans-serif; letter-spacing:.08em;
    text-transform:uppercase; color:#767676; border-top:1px solid #262626;
  }
  .at-pm-ac .h:first-child{ border-top:none; }
  .at-pm-ac .i{
    display:flex; align-items:center; gap:10px; padding:7px 11px; cursor:pointer; color:#ddd;
  }
  .at-pm-ac .i.sel, .at-pm-ac .i:hover{ background:#2a3320; }
  .at-pm-ac .i img, .at-pm-ac .i .ph{
    width:36px; height:36px; border-radius:6px; object-fit:cover; flex:none;
    background:#111; border:1px solid #444;
  }
  .at-pm-ac .i .ph{
    display:flex; align-items:center; justify-content:center; font:700 9px sans-serif; color:#888;
  }
  .at-pm-ac .nm{ font:600 12px 'Segoe UI',sans-serif; color:#b8f55a; }
  .at-pm-ac .i.audio .nm{ color:#7ec8ff; }
  .at-pm-ac .i.video .nm{ color:#ffb86b; }
  .at-pm-ac .ds{ font-size:10.5px; color:#767676; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .at-pm-ac .empty{ padding:10px 12px; color:#767676; font-size:11.5px; }

  .at-pm-prev{
    position:fixed; z-index:10960; display:none; background:#232323; border:1px solid #555;
    border-radius:10px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,.55);
    width:180px; pointer-events:none;
  }
  .at-pm-prev img{ display:block; width:100%; height:140px; object-fit:cover; background:#111; }
  .at-pm-prev .ph{
    height:140px; display:flex; align-items:center; justify-content:center;
    color:#888; font:600 12px 'Segoe UI',sans-serif; background:#111;
  }
  .at-pm-prev .lb{
    padding:6px 8px; font:600 11px 'Segoe UI',sans-serif; color:#b8f55a; text-align:center;
  }
  `;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}

function acPopup() {
  if (_acEl) return _acEl;
  _acEl = document.createElement("div");
  _acEl.className = "at-pm-ac";
  document.body.appendChild(_acEl);
  return _acEl;
}

export function closeAC() {
  if (_acEl) _acEl.style.display = "none";
  _ac = null;
  hidePreview();
}

function previewEl() {
  if (_preview) return _preview;
  _preview = document.createElement("div");
  _preview.className = "at-pm-prev";
  document.body.appendChild(_preview);
  return _preview;
}

function hidePreview() {
  if (_preview) _preview.style.display = "none";
}

function showPreview(asset, anchorRect) {
  if (!asset) {
    hidePreview();
    return;
  }
  const el = previewEl();
  el.innerHTML = "";
  if (asset.thumb) {
    const img = document.createElement("img");
    img.src = asset.thumb;
    img.alt = asset.label;
    el.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "ph";
    ph.textContent = asset.kind === "Audio" ? "AUDIO" : asset.kind === "Video" ? "VIDEO" : "IMG";
    el.appendChild(ph);
  }
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.textContent = `@${asset.label}`;
  el.appendChild(lb);
  el.style.display = "block";
  const gap = 10;
  let left = (anchorRect?.right || 0) + gap;
  let top = anchorRect?.top || 80;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left + 190 > vw - 8) left = Math.max(8, (anchorRect?.left || 0) - 190 - gap);
  if (top + 180 > vh - 8) top = Math.max(8, vh - 188);
  el.style.left = left + "px";
  el.style.top = top + "px";
}

function promptWidget(node) {
  return (node.widgets || []).find((w) => w && w.name === "prompt") || null;
}

function getPrompt(node) {
  const w = promptWidget(node);
  return typeof w?.value === "string" ? w.value : "";
}

function setPrompt(node, text, { dirty = true } = {}) {
  const w = promptWidget(node);
  if (w) w.value = text;
  if (node._atPmTa && node._atPmTa.value !== text) {
    const pos = node._atPmTa.selectionStart;
    node._atPmTa.value = text;
    try {
      node._atPmTa.selectionStart = node._atPmTa.selectionEnd = Math.min(pos, text.length);
    } catch (_e) { /* ignore */ }
  }
  paintBackdrop(node);
  if (dirty) {
    notifyGraphChanged();
    node.setDirtyCanvas?.(true, true);
  }
}

function paintBackdrop(node) {
  const bd = node._atPmBd;
  const ta = node._atPmTa;
  if (!bd || !ta) return;
  bd.innerHTML = backdropHTML(ta.value);
  syncColumns(ta, bd);
}

function hideStockWidget(node) {
  const w = promptWidget(node);
  if (!w) return;
  w.computeSize = () => [0, -4];
  if (w.element) {
    w.element.style.display = "none";
    w.element.style.height = "0";
    w.element.style.overflow = "hidden";
  }
}

function renderTray(node, assets) {
  const tray = node._atPmTray;
  if (!tray) return;
  tray.innerHTML = "";
  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Wire Multi Reference + Load Audio into Fixed 3 Audio Refs to list @ refs here.";
    tray.appendChild(empty);
    return;
  }
  for (const a of assets) {
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.title = `Insert ${tagFor(a.kind, a.ordinal)}`;
    if (a.thumb) {
      const img = document.createElement("img");
      img.src = a.thumb;
      img.alt = a.label;
      thumb.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "ph";
      ph.textContent = a.kind === "Audio" ? "AUD" : a.kind === "Video" ? "VID" : "IMG";
      thumb.appendChild(ph);
    }
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = a.label;
    thumb.appendChild(badge);
    thumb.addEventListener("click", () => {
      insertTag(node, tagFor(a.kind, a.ordinal));
    });
    thumb.addEventListener("pointerenter", (e) => {
      showPreview(a, e.currentTarget.getBoundingClientRect());
    });
    thumb.addEventListener("pointerleave", hidePreview);
    tray.appendChild(thumb);
  }
}

function insertTag(node, tag, replaceFrom = null) {
  const ta = node._atPmTa;
  if (!ta) {
    setPrompt(node, (getPrompt(node) + (getPrompt(node).endsWith(" ") ? "" : " ") + tag).trimStart());
    return;
  }
  const start = replaceFrom != null ? replaceFrom : ta.selectionStart;
  const end = ta.selectionEnd;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const needsSpace = before && !/\s$/.test(before) && !before.endsWith("<");
  const piece = (needsSpace && replaceFrom == null ? " " : "") + tag;
  const next = before + piece + after;
  const caret = (before + piece).length;
  ta.value = next;
  ta.focus();
  ta.selectionStart = ta.selectionEnd = caret;
  setPrompt(node, next);
  closeAC();
}

function openAC(node, ta, start, query) {
  const assets = filterAssets(node._atPmAssets || [], query);
  const el = acPopup();
  el.innerHTML = "";
  const flat = [];

  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = query
      ? `No ref matches "@${query}".`
      : "No wired Picture/Audio refs found. Connect Multi Reference and Load Audio to Fixed 3 Audio Refs.";
    el.appendChild(empty);
  } else {
    const groups = [
      { key: "Picture", title: "Images" },
      { key: "Audio", title: "Audio" },
      { key: "Video", title: "Video" },
    ];
    for (const g of groups) {
      const items = assets.filter((a) => a.kind === g.key);
      if (!items.length) continue;
      const h = document.createElement("div");
      h.className = "h";
      h.textContent = g.title;
      el.appendChild(h);
      for (const a of items) {
        const idx = flat.length;
        flat.push(a);
        const row = document.createElement("div");
        row.className = "i" + (a.kind === "Audio" ? " audio" : a.kind === "Video" ? " video" : "") + (idx === 0 ? " sel" : "");
        row.dataset.i = String(idx);
        if (a.thumb) {
          const img = document.createElement("img");
          img.src = a.thumb;
          img.alt = "";
          row.appendChild(img);
        } else {
          const ph = document.createElement("div");
          ph.className = "ph";
          ph.textContent = a.kind === "Audio" ? "AUD" : "VID";
          row.appendChild(ph);
        }
        const meta = document.createElement("div");
        meta.innerHTML = `<div class="nm">@${escapeAttr(a.label)}</div><div class="ds">${escapeAttr(a.title || "")}</div>`;
        row.appendChild(meta);
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          pickAC(node, flat[idx]);
        });
        row.addEventListener("pointerenter", () => {
          selectAC(idx);
          showPreview(a, row.getBoundingClientRect());
        });
        el.appendChild(row);
      }
    }
  }

  _ac = { node, ta, start, items: flat, sel: flat.length ? 0 : -1 };
  el.style.display = "block";
  placeZoomedPopup(el, ta, { baseFontPx: 12, minWidthPx: 280, baseMaxHeightPx: 260 });
  if (flat[0]) showPreview(flat[0], el.getBoundingClientRect());
  else hidePreview();
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectAC(idx) {
  if (!_ac || !_acEl) return;
  _ac.sel = idx;
  _acEl.querySelectorAll(".i").forEach((row) => {
    row.classList.toggle("sel", Number(row.dataset.i) === idx);
  });
}

function pickAC(node, asset) {
  if (!asset || !_ac) return;
  insertTag(node, tagFor(asset.kind, asset.ordinal), _ac.start);
}

function maybeAC(node, ta) {
  const q = atQueryAt(ta.value, ta.selectionStart);
  if (!q) {
    closeAC();
    return;
  }
  openAC(node, ta, q.start, q.query);
}

function onAcKeydown(e, node, ta) {
  if (!_ac || _ac.ta !== ta) return false;
  const n = _ac.items.length;
  if (e.key === "Escape") {
    e.preventDefault();
    closeAC();
    return true;
  }
  if (!n) return false;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectAC((_ac.sel + 1) % n);
    const a = _ac.items[_ac.sel];
    const row = _acEl?.querySelector(`.i[data-i="${_ac.sel}"]`);
    if (row) showPreview(a, row.getBoundingClientRect());
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    selectAC((_ac.sel - 1 + n) % n);
    const a = _ac.items[_ac.sel];
    const row = _acEl?.querySelector(`.i[data-i="${_ac.sel}"]`);
    if (row) showPreview(a, row.getBoundingClientRect());
    return true;
  }
  if (e.key === "Enter" || e.key === "Tab") {
    if (_ac.sel >= 0 && _ac.items[_ac.sel]) {
      e.preventDefault();
      pickAC(node, _ac.items[_ac.sel]);
      return true;
    }
  }
  return false;
}

export function refreshAssets(node) {
  const { assets } = discoverAssets(node);
  const key = assetKey(assets);
  if (node._atPmAssetKey === key) return assets;
  node._atPmAssetKey = key;
  node._atPmAssets = assets;
  renderTray(node, assets);
  return assets;
}

export function buildFace(node) {
  injectCSS();
  hideStockWidget(node);

  const root = document.createElement("div");
  root.className = ROOT;
  root.style.setProperty("--acc", accentOf(node) || ACC);

  const tray = document.createElement("div");
  tray.className = "tray";
  root.appendChild(tray);

  const editor = document.createElement("div");
  editor.className = "editor";
  const bd = document.createElement("div");
  bd.className = "bd";
  const ta = document.createElement("textarea");
  ta.className = "ta";
  ta.spellcheck = false;
  ta.placeholder = "Write a prompt. Type @ to mention a Picture or Audio ref.";
  editor.appendChild(bd);
  editor.appendChild(ta);
  root.appendChild(editor);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Mentions insert MiniMax tags like <Picture 1> / <Audio 1>. Ordinals follow Fixed 3 Audio Refs wiring.";
  root.appendChild(hint);

  node._atPmRoot = root;
  node._atPmTray = tray;
  node._atPmBd = bd;
  node._atPmTa = ta;

  const initial = getPrompt(node);
  ta.value = initial;
  paintBackdrop(node);
  refreshAssets(node);

  ta.addEventListener("input", () => {
    setPrompt(node, ta.value);
    maybeAC(node, ta);
  });
  ta.addEventListener("click", () => maybeAC(node, ta));
  ta.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) maybeAC(node, ta);
  });
  ta.addEventListener("keydown", (e) => {
    if (onAcKeydown(e, node, ta)) return;
  });
  ta.addEventListener("blur", () => {
    const next = canonicalizeText(ta.value);
    if (next !== ta.value) setPrompt(node, next);
    setTimeout(() => {
      if (document.activeElement !== ta) closeAC();
    }, 120);
  });
  ta.addEventListener("scroll", () => {
    bd.scrollTop = ta.scrollTop;
    bd.scrollLeft = ta.scrollLeft;
  });

  const ro = new ResizeObserver(() => syncColumns(ta, bd));
  ro.observe(ta);
  node._atPmRo = ro;

  return root;
}

export function renderFace(node) {
  if (!node?._atPmRoot) return;
  node._atPmRoot.style.setProperty("--acc", accentOf(node) || ACC);
  hideStockWidget(node);
  const text = getPrompt(node);
  if (node._atPmTa && node._atPmTa.value !== text && document.activeElement !== node._atPmTa) {
    node._atPmTa.value = text;
  }
  paintBackdrop(node);
  refreshAssets(node);
}

export function destroyFace(node) {
  try { node._atPmRo?.disconnect(); } catch (_e) { /* gone */ }
  if (_ac?.node === node) closeAC();
  node._atPmRoot = null;
  node._atPmTray = null;
  node._atPmBd = null;
  node._atPmTa = null;
  node._atPmRo = null;
  node._atPmAssets = null;
  node._atPmAssetKey = null;
}

// re-export for tests / callers
export { displayLabel, tagFor, canonicalizeText };
