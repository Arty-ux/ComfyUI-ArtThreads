// Prompt Mentions ArtThreads — tray + @ dropdown + chip highlight backdrop.

import { ACC, accentOf } from "../shared/node_settings.mjs";
import { placeZoomedPopup } from "../shared/popup_zoom.mjs";
import { notifyGraphChanged } from "../shared/graph_changed.mjs";
import {
  atQueryAt,
  filterAssets,
  canonicalizeText,
  scanMentions,
  mentionAt,
  backdropHTML,
  tagFor,
  displayLabel,
} from "./core.mjs";
import { discoverAssets, assetKey, activeMentionKeys } from "./discover.mjs";

const CARET_ANCHOR_ID = "at-pm-caret-anchor";

const ROOT = "at-pm-root";
const STYLE_ID = "at-pm-style";
let _acEl = null;
let _ac = null;
let _preview = null;

export function injectCSS() {
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
  .${ROOT} .thumb.used{ border-color:#7ec8ff; box-shadow:inset 0 0 0 1px rgba(126,200,255,0.35); }
  .${ROOT} .thumb.used.picture{ border-color:#b8f55a; box-shadow:inset 0 0 0 1px rgba(184,245,90,0.35); }
  .${ROOT} .thumb.used.video{ border-color:#ffb86b; box-shadow:inset 0 0 0 1px rgba(255,184,107,0.35); }
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
  /* Transparent textarea over highlighted backdrop. Chip spans must NOT add
     padding/margin/border or caret and glyphs drift apart. */
  .${ROOT} .bd, .${ROOT} .ta{
    position:absolute; inset:0; box-sizing:border-box; margin:0;
    padding:10px 12px; border:0; width:100%; height:100%;
    font:12.5px/1.45 'Segoe UI',sans-serif; letter-spacing:normal;
    font-kerning:none; font-variant-ligatures:none;
    white-space:pre-wrap; overflow-wrap:break-word; word-wrap:break-word;
    overflow:auto; scrollbar-gutter:stable;
  }
  .${ROOT} .bd{
    color:#c8c8c8; pointer-events:none; background:transparent; z-index:0;
  }
  .${ROOT} .ta{
    color:transparent; -webkit-text-fill-color:transparent;
    caret-color:#fff; background:transparent; resize:none; outline:none; z-index:1;
  }
  .${ROOT} .ta.over-chip{ cursor:pointer; }
  .${ROOT} .ta::placeholder{
    color:#666; -webkit-text-fill-color:#666;
  }
  .${ROOT} .hint{
    flex:none; color:#7a7a7a; font-size:11px; line-height:1.35;
  }
  .at-pm-chip{
    color:#b8f55a; background:rgba(120,200,40,0.20); border-radius:3px;
    text-decoration:underline; text-underline-offset:2px;
    box-decoration-break:clone; -webkit-box-decoration-break:clone;
  }
  .at-pm-chip.audio{ color:#7ec8ff; background:rgba(80,160,255,0.18); }
  .at-pm-chip.video{ color:#ffb86b; background:rgba(255,160,60,0.18); }
  .at-pm-chip.off{
    color:#8a8a8a; background:transparent;
    text-decoration:underline wavy #666; text-underline-offset:2px;
  }

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
  .at-pm-ac .i.cur{
    background:#243018; box-shadow:inset 3px 0 0 ${ACC};
  }
  .at-pm-ac .i.cur.sel{ background:#2f3d1c; }
  .at-pm-ac .i img, .at-pm-ac .i .ph{
    width:36px; height:36px; border-radius:6px; object-fit:cover; flex:none;
    background:#111; border:1px solid #444;
  }
  .at-pm-ac .i.cur img, .at-pm-ac .i.cur .ph{ border-color:${ACC}; }
  .at-pm-ac .i .ph{
    display:flex; align-items:center; justify-content:center; font:700 9px sans-serif; color:#888;
  }
  .at-pm-ac .nm{ font:600 12px 'Segoe UI',sans-serif; color:#b8f55a; }
  .at-pm-ac .i.audio .nm{ color:#7ec8ff; }
  .at-pm-ac .i.video .nm{ color:#ffb86b; }
  .at-pm-ac .ds{ font-size:10.5px; color:#767676; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .at-pm-ac .cur-tag{
    margin-left:auto; flex:none; font:700 9px 'Segoe UI',sans-serif; letter-spacing:.04em;
    text-transform:uppercase; color:${ACC}; opacity:.9;
  }
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
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
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
  const ta = node._atPmTa;
  if (ta && ta.value !== text) {
    const pos = ta.selectionStart;
    const end = ta.selectionEnd;
    const st = ta.scrollTop;
    const sl = ta.scrollLeft;
    ta.value = text;
    try {
      const n = text.length;
      ta.selectionStart = Math.min(pos, n);
      ta.selectionEnd = Math.min(end, n);
      ta.scrollTop = st;
      ta.scrollLeft = sl;
    } catch (_e) { /* ignore */ }
  }
  paintBackdrop(node);
  markUsedMentions(node);
  if (dirty) {
    notifyGraphChanged();
    node.setDirtyCanvas?.(true, true);
  }
}

function paintBackdrop(node) {
  const bd = node._atPmBd;
  const ta = node._atPmTa;
  if (!bd || !ta) return;
  const keys = activeMentionKeys(node._atPmAssets || []);
  const st = ta.scrollTop;
  const sl = ta.scrollLeft;
  bd.innerHTML = backdropHTML(ta.value, keys);
  bd.scrollTop = st;
  bd.scrollLeft = sl;
}

function usedMentionKeys(text) {
  const keys = new Set();
  for (const m of scanMentions(text)) keys.add(`${m.kind}:${m.ordinal}`);
  return keys;
}

function markUsedMentions(node) {
  const tray = node._atPmTray;
  if (!tray) return;
  const used = usedMentionKeys(node._atPmTa?.value ?? getPrompt(node));
  tray.querySelectorAll(".thumb[data-key]").forEach((el) => {
    const on = used.has(el.dataset.key);
    el.classList.toggle("used", on);
  });
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
    const kindCls = a.kind === "Picture" ? "picture" : a.kind === "Video" ? "video" : "";
    thumb.className = "thumb" + (kindCls ? ` ${kindCls}` : "");
    thumb.dataset.key = `${a.kind}:${a.ordinal}`;
    thumb.title = `Insert ${tagFor(a.kind, a.ordinal)}`;
    if (a.thumb) {
      const img = document.createElement("img");
      img.src = a.thumb;
      img.alt = a.label;
      thumb.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "ph";
      ph.textContent = a.kind === "Source" ? "SRC" : a.kind === "Audio" ? "AUD" : a.kind === "Video" ? "VID" : "IMG";
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
  markUsedMentions(node);
}

/** Caret/marker client rect inside a (possibly canvas-zoomed) textarea. */
function caretClientRect(ta, pos = ta.selectionStart) {
  const parent = ta.parentElement;
  if (!parent) return ta.getBoundingClientRect();
  const cs = getComputedStyle(ta);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  const font = cs.font && cs.font !== "0px" ? cs.font
    : `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
  mirror.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    `width:${ta.clientWidth}px`,
    `height:${ta.clientHeight}px`,
    "visibility:hidden",
    "pointer-events:none",
    "white-space:pre-wrap",
    "overflow-wrap:break-word",
    "word-wrap:break-word",
    "overflow:hidden",
    "box-sizing:border-box",
    `padding:${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
    "border:0",
    `font:${font}`,
    `letter-spacing:${cs.letterSpacing || "normal"}`,
    `line-height:${cs.lineHeight}`,
  ].join(";");
  const before = document.createTextNode(ta.value.slice(0, pos));
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(before);
  mirror.appendChild(marker);
  mirror.appendChild(document.createTextNode(ta.value.slice(pos) || "."));
  parent.appendChild(mirror);
  mirror.scrollTop = ta.scrollTop;
  mirror.scrollLeft = ta.scrollLeft;
  const rect = marker.getBoundingClientRect();
  mirror.remove();
  if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
    return ta.getBoundingClientRect();
  }
  return rect;
}

function caretAnchorEl(rect) {
  let el = document.getElementById(CARET_ANCHOR_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CARET_ANCHOR_ID;
    el.style.cssText = "position:fixed;width:1px;pointer-events:none;opacity:0;z-index:0;";
    document.body.appendChild(el);
  }
  const h = Math.max(12, Math.round(rect.height || 14));
  el.style.left = `${Math.round(rect.left)}px`;
  el.style.top = `${Math.round(rect.top)}px`;
  el.style.height = `${h}px`;
  return el;
}

function placeACAtCaret(pop, ta, pos) {
  try {
    const rect = caretClientRect(ta, pos);
    const anchor = caretAnchorEl(rect);
    placeZoomedPopup(pop, anchor, {
      baseFontPx: 12,
      minWidthPx: 280,
      baseMaxHeightPx: 260,
      anchorWidthIsMin: false,
    });
  } catch (e) {
    console.warn("[ArtThreads Prompt] caret popup place failed", e);
    placeZoomedPopup(pop, ta, {
      baseFontPx: 12,
      minWidthPx: 280,
      baseMaxHeightPx: 260,
      anchorWidthIsMin: false,
    });
  }
}

function insertTag(node, tag, replaceFrom = null, replaceTo = null) {
  const ta = node._atPmTa;
  if (!ta) {
    setPrompt(node, (getPrompt(node) + (getPrompt(node).endsWith(" ") ? "" : " ") + tag).trimStart());
    return;
  }
  const start = replaceFrom != null ? replaceFrom : ta.selectionStart;
  const end = replaceTo != null ? replaceTo : ta.selectionEnd;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const replacing = replaceFrom != null;
  const needsSpace = !replacing && before && !/\s$/.test(before) && !before.endsWith("<");
  const piece = (needsSpace ? " " : "") + tag;
  const next = before + piece + after;
  const caret = (before + piece).length;
  ta.value = next;
  ta.focus();
  ta.selectionStart = ta.selectionEnd = caret;
  setPrompt(node, next);
  closeAC();
}

function openAC(node, ta, opts = {}) {
  const start = opts.start ?? ta.selectionStart;
  const end = opts.end ?? ta.selectionStart;
  const query = opts.query || "";
  const kind = opts.kind || null;
  const currentOrdinal = opts.currentOrdinal;
  let assets = filterAssets(node._atPmAssets || [], query);
  if (kind) assets = assets.filter((a) => a.kind === kind);
  const el = acPopup();
  el.innerHTML = "";
  const flat = [];

  // Prefer the asset already linked to this chip (same kind + ordinal).
  let selIdx = -1;
  if (kind != null && currentOrdinal != null) {
    const want = Number(currentOrdinal);
    selIdx = assets.findIndex((a) => a.kind === kind && Number(a.ordinal) === want);
  }

  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = query
      ? `No ref matches "@${query}".`
      : "No wired Picture/Audio refs found. Connect Multi Reference and Load Audio to Fixed 3 Audio Refs.";
    el.appendChild(empty);
  } else {
    if (selIdx < 0) selIdx = 0;
    const groups = [
      { key: "Picture", title: "Images" },
      { key: "Source", title: "Source Audio" },
      { key: "Audio", title: "Audio Refs" },
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
        const isCurrent = kind != null && currentOrdinal != null
          && a.kind === kind && Number(a.ordinal) === Number(currentOrdinal);
        const row = document.createElement("div");
        const isAud = a.kind === "Audio" || a.kind === "Source";
        row.className = "i"
          + (isAud ? " audio" : a.kind === "Video" ? " video" : "")
          + (idx === selIdx ? " sel" : "")
          + (isCurrent ? " cur" : "");
        row.dataset.i = String(idx);
        if (a.thumb) {
          const img = document.createElement("img");
          img.src = a.thumb;
          img.alt = "";
          row.appendChild(img);
        } else {
          const ph = document.createElement("div");
          ph.className = "ph";
          ph.textContent = a.kind === "Source" ? "SRC" : a.kind === "Audio" ? "AUD" : a.kind === "Picture" ? "IMG" : "VID";
          row.appendChild(ph);
        }
        const meta = document.createElement("div");
        meta.style.cssText = "min-width:0; flex:1;";
        meta.innerHTML = `<div class="nm">@${escapeAttr(a.label)}</div><div class="ds">${escapeAttr(a.title || "")}</div>`;
        row.appendChild(meta);
        if (isCurrent) {
          const tag = document.createElement("div");
          tag.className = "cur-tag";
          tag.textContent = "current";
          row.appendChild(tag);
        }
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

  _ac = {
    node,
    ta,
    start,
    end,
    kind,
    replaceMention: !!opts.replaceMention,
    items: flat,
    sel: flat.length ? Math.max(0, selIdx) : -1,
  };
  el.style.display = "block";
  placeACAtCaret(el, ta, Math.min(end, ta.value.length));
  const cur = flat[_ac.sel];
  if (cur) {
    const row = el.querySelector(`.i[data-i="${_ac.sel}"]`);
    try { row?.scrollIntoView?.({ block: "nearest" }); } catch (_e) { /* ignore */ }
    showPreview(cur, (row || el).getBoundingClientRect());
  } else {
    hidePreview();
  }
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
  insertTag(node, tagFor(asset.kind, asset.ordinal), _ac.start, _ac.end);
}

function maybeAC(node, ta) {
  const q = atQueryAt(ta.value, ta.selectionStart);
  if (!q) {
    closeAC();
    return;
  }
  openAC(node, ta, { start: q.start, end: ta.selectionStart, query: q.query });
}

function openMentionReplace(node, ta, mention) {
  if (!mention) return;
  ta.selectionStart = mention.start;
  ta.selectionEnd = mention.end;
  openAC(node, ta, {
    start: mention.start,
    end: mention.end,
    query: "",
    kind: mention.kind,
    currentOrdinal: mention.ordinal,
    replaceMention: true,
  });
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
  if (node._atPmAssetKey === key) {
    paintBackdrop(node);
    markUsedMentions(node);
    return assets;
  }
  node._atPmAssetKey = key;
  node._atPmAssets = assets;
  renderTray(node, assets);
  paintBackdrop(node);
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
  hint.textContent = "Type @ to insert. Click a colored <Picture N>/<Audio N> chip to replace it.";
  root.appendChild(hint);

  node._atPmRoot = root;
  node._atPmTray = tray;
  node._atPmBd = bd;
  node._atPmTa = ta;

  const initial = getPrompt(node);
  ta.value = initial;
  try { refreshAssets(node); } catch (e) {
    console.warn("[ArtThreads Prompt] refreshAssets failed", e);
  }
  paintBackdrop(node);

  ta.addEventListener("input", () => {
    setPrompt(node, ta.value);
    try { maybeAC(node, ta); } catch (e) {
      console.warn("[ArtThreads Prompt] @ menu failed", e);
    }
  });
  ta.addEventListener("click", () => {
    try {
      // Collapsed click on a mention chip = open replace (link-like).
      // Drag-select keeps native editing.
      if (ta.selectionStart === ta.selectionEnd) {
        const m = mentionAt(ta.value, ta.selectionStart);
        if (m) {
          openMentionReplace(node, ta, m);
          return;
        }
      }
      maybeAC(node, ta);
    } catch (e) {
      console.warn("[ArtThreads Prompt] click handler failed", e);
    }
  });
  ta.addEventListener("mousemove", (e) => {
    // Approximate "link" cursor when the caret under the pointer sits on a chip.
    try {
      const before = ta.selectionStart;
      // Use character index from click-like mapping via textarea value length heuristic:
      // temporarily rely on last known selection during hover near chips — better:
      // probe with a mirror hit if cheap. Fallback: toggle on current caret mention.
      const pos = charIndexFromPoint(ta, e.clientX, e.clientY);
      const m = mentionAt(ta.value, pos != null ? pos : before);
      ta.classList.toggle("over-chip", !!m);
    } catch (_e) {
      ta.classList.remove("over-chip");
    }
  });
  ta.addEventListener("mouseleave", () => ta.classList.remove("over-chip"));
  ta.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      try { maybeAC(node, ta); } catch (_e) { /* ignore */ }
    }
  });
  ta.addEventListener("keydown", (e) => {
    if (onAcKeydown(e, node, ta)) return;
  });
  ta.addEventListener("scroll", () => {
    bd.scrollTop = ta.scrollTop;
    bd.scrollLeft = ta.scrollLeft;
  });
  ta.addEventListener("blur", () => {
    const next = canonicalizeText(ta.value);
    if (next !== ta.value) setPrompt(node, next);
    setTimeout(() => {
      if (document.activeElement !== ta && !_acEl?.contains(document.activeElement)) closeAC();
    }, 120);
  });

  return root;
}

/** Map a client point to a character index in the textarea (mirror hit-test). */
function charIndexFromPoint(ta, clientX, clientY) {
  const parent = ta.parentElement;
  if (!parent) return ta.selectionStart;
  const cs = getComputedStyle(ta);
  const font = cs.font && cs.font !== "0px" ? cs.font
    : `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
  const mirror = document.createElement("div");
  mirror.style.cssText = [
    "position:absolute", "left:0", "top:0",
    `width:${ta.clientWidth}px`, `height:${ta.clientHeight}px`,
    "visibility:hidden", "pointer-events:none", "white-space:pre-wrap",
    "overflow-wrap:break-word", "overflow:hidden", "box-sizing:border-box",
    `padding:${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
    "border:0", `font:${font}`, `line-height:${cs.lineHeight}`,
    "font-kerning:none", "font-variant-ligatures:none",
  ].join(";");
  const text = ta.value;
  // One span per character is too heavy — binary search with a marker span.
  const before = document.createTextNode("");
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  const after = document.createTextNode("");
  mirror.append(before, marker, after);
  parent.appendChild(mirror);
  mirror.scrollTop = ta.scrollTop;
  mirror.scrollLeft = ta.scrollLeft;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    before.textContent = text.slice(0, mid);
    after.textContent = text.slice(mid);
    const r = marker.getBoundingClientRect();
    // Compare against pointer: if marker is above/left of point, search right.
    if (r.top + r.height < clientY) lo = mid + 1;
    else if (r.top > clientY) hi = mid;
    else if (r.left < clientX) lo = mid + 1;
    else hi = mid;
  }
  mirror.remove();
  return Math.max(0, Math.min(text.length, lo));
}

export function renderFace(node) {
  if (!node?._atPmRoot) return;
  node._atPmRoot.style.setProperty("--acc", accentOf(node) || ACC);
  hideStockWidget(node);
  const text = getPrompt(node);
  if (node._atPmTa && node._atPmTa.value !== text && document.activeElement !== node._atPmTa) {
    node._atPmTa.value = text;
  }
  refreshAssets(node);
  paintBackdrop(node);
  markUsedMentions(node);
}

export function destroyFace(node) {
  if (_ac?.node === node) closeAC();
  node._atPmRoot = null;
  node._atPmTray = null;
  node._atPmBd = null;
  node._atPmTa = null;
  node._atPmAssets = null;
  node._atPmAssetKey = null;
}

// re-export for tests / callers
export { displayLabel, tagFor, canonicalizeText };
