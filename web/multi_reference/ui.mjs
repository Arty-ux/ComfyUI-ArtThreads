// Multi Reference ArtThreads — Deno-like card board, ArtThreads colors.

import { ACC, accentOf } from "../shared/node_settings.mjs";
import { placeZoomedPopup } from "../shared/popup_zoom.mjs";
import {
  CARD_PREVIEW_H,
  MAX_IMAGES,
  appendWithinLimit,
  readState,
  writeState,
} from "./core.mjs";
import { imageFileUrl, listImageFiles, uploadImage } from "./api.mjs";

const ROOT = "at-mr-root";
let _cssDone = false;
let _popup = null;
let _toastTimer = 0;

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
  .${ROOT}.drag{
    border-color:${ACC}; box-shadow:inset 0 0 0 1px ${ACC};
  }
  .${ROOT} .bar{ display:flex; gap:6px; align-items:center; flex:none; }
  .${ROOT} .btn{
    box-sizing:border-box; background:rgba(255,255,255,0.04);
    border:1px solid #444; border-radius:4px;
    color:#d8d8d8; font-size:11px; padding:5px 9px; cursor:pointer;
    user-select:none; flex:none;
  }
  .${ROOT} .btn:hover{ border-color:${ACC}; color:#fff; }
  .${ROOT} .btn.danger:hover{ border-color:#e05252; color:#ffb4b4; }
  .${ROOT} .count{
    margin-left:auto; color:${ACC}; font:600 11px 'Segoe UI',sans-serif;
  }
  .${ROOT} .hint{ color:#8a8a8a; font-size:11px; flex:none; line-height:1.35; }
  .${ROOT} .grid{
    flex:1; min-height:0; overflow-y:auto; display:flex; flex-wrap:wrap;
    align-content:flex-start; align-items:flex-start; gap:10px; padding-right:2px;
  }
  .${ROOT} .card{
    position:relative; flex:0 0 auto; max-width:100%;
    border-radius:8px; overflow:hidden; background:#111;
    border:1px solid #444; cursor:grab; box-sizing:border-box;
  }
  .${ROOT} .card:hover{ border-color:${ACC}; }
  .${ROOT} .card img{
    display:block; width:100%; height:100%; object-fit:contain; pointer-events:none;
  }
  .${ROOT} .badge{
    position:absolute; left:0; bottom:0; background:rgba(0,0,0,0.72);
    color:#eee; padding:2px 6px; font:700 11px sans-serif;
    border-top-right-radius:8px;
  }
  .${ROOT} .rm{
    position:absolute; top:5px; right:5px; width:22px; height:22px;
    border:none; border-radius:999px; background:rgba(0,0,0,0.72);
    color:#fff; cursor:pointer; font:700 14px/1 sans-serif;
  }
  .${ROOT} .rm:hover{ background:${ACC}; color:#fff; }
  .${ROOT} .ph{
    border:1px dashed ${ACC}; border-radius:8px;
    background:rgba(91,141,239,0.12); box-sizing:border-box;
  }
  .${ROOT} .empty{
    flex:1; min-height:80px; display:flex; align-items:center; justify-content:center;
    color:#777; font-size:12px; border:1px dashed #444; border-radius:8px;
    text-align:center; padding:12px;
  }

  .at-mr-pop{
    position:fixed; z-index:10900; background:#232323; border:1px solid #555;
    border-radius:6px; box-shadow:0 10px 30px rgba(0,0,0,0.5); overflow:auto;
    font-family:'Segoe UI',sans-serif; padding:0.25em 0; max-height:50vh;
  }
  .at-mr-pop .it{
    padding:0.4em 0.8em; cursor:pointer; font-size:1em; color:#ddd;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .at-mr-pop .it:hover{ background:#2f2f2f; }
  .at-mr-pop .it.on{ color:${ACC}; }
  .at-mr-pop .em{ padding:0.5em 0.8em; font-size:0.92em; color:#888; }

  .at-mr-toast{
    position:fixed; z-index:11000; left:50%; bottom:28px; transform:translateX(-50%);
    background:#1a1a1a; border:1px solid ${ACC}; color:#ddd; border-radius:8px;
    padding:10px 14px; font:12px 'Segoe UI',sans-serif; max-width:min(420px,92vw);
    box-shadow:0 12px 40px rgba(0,0,0,0.55);
  }
  `;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}

function showToast(msg) {
  document.querySelectorAll(".at-mr-toast").forEach((t) => t.remove());
  const toast = document.createElement("div");
  toast.className = "at-mr-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.remove(), 3200);
}

function closePopup() {
  try { _popup?.remove(); } catch (_e) { /* gone */ }
  _popup = null;
  document.removeEventListener("pointerdown", onOutside, true);
  document.removeEventListener("wheel", onWheel, true);
  document.removeEventListener("keydown", onEsc, true);
}

function onOutside(e) {
  if (_popup && !_popup.contains(e.target)) closePopup();
}
function onWheel(e) {
  if (_popup && !_popup.contains(e.target)) closePopup();
}
function onEsc(e) {
  if (e.key === "Escape" && _popup) { e.stopPropagation(); closePopup(); }
}

function cardLayout(nw, nh, previewH = CARD_PREVIEW_H) {
  const w = Math.max(1, Number(nw) || 1);
  const h = Math.max(1, Number(nh) || 1);
  const height = previewH;
  const width = Math.max(64, Math.round((w / h) * height));
  return { width, height, aspectRatio: `${w} / ${h}` };
}

async function openFolderPicker(node, anchor, onPick) {
  closePopup();
  const pop = document.createElement("div");
  pop.className = "at-mr-pop";
  const loading = document.createElement("div");
  loading.className = "em";
  loading.textContent = "reading the input folder...";
  pop.appendChild(loading);
  document.body.appendChild(pop);
  _popup = pop;
  placeZoomedPopup(pop, anchor, { baseFontPx: 12, minWidthPx: 180, baseMaxHeightPx: 320 });
  document.addEventListener("pointerdown", onOutside, true);
  document.addEventListener("wheel", onWheel, true);
  document.addEventListener("keydown", onEsc, true);

  const { files, error } = await listImageFiles();
  if (_popup !== pop) return;
  pop.textContent = "";
  if (error || !files.length) {
    const em = document.createElement("div");
    em.className = "em";
    em.textContent = error
      ? "could not read the input folder"
      : "no images in ComfyUI's input folder";
    pop.appendChild(em);
  } else {
    const selected = new Set(readState(node).files);
    for (const name of files) {
      const it = document.createElement("div");
      it.className = "it" + (selected.has(name) ? " on" : "");
      it.textContent = name;
      it.title = name;
      it.addEventListener("click", () => { closePopup(); onPick(name); });
      pop.appendChild(it);
    }
  }
  placeZoomedPopup(pop, anchor, { baseFontPx: 12, minWidthPx: 180, baseMaxHeightPx: 320 });
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  const n = String(file.name || "").toLowerCase();
  return /\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(n);
}

export function buildFace(node) {
  injectCSS();
  const root = document.createElement("div");
  root.className = ROOT;
  root.tabIndex = 0;

  const bar = document.createElement("div");
  bar.className = "bar";

  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.className = "btn";
  uploadBtn.textContent = "Upload";

  const folderBtn = document.createElement("button");
  folderBtn.type = "button";
  folderBtn.className = "btn";
  folderBtn.textContent = "Input Folder";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn danger";
  clearBtn.textContent = "Clear";

  const count = document.createElement("div");
  count.className = "count";

  bar.append(uploadBtn, folderBtn, clearBtn, count);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Drag files, press Ctrl+V, use Upload, or Input Folder. Drag cards to reorder.";

  const grid = document.createElement("div");
  grid.className = "grid";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  fileInput.style.display = "none";

  root.append(bar, hint, grid, fileInput);

  let draggedCard = null;
  let placeholder = null;
  let isReordering = false;
  let dragDepth = 0;

  function getFiles() {
    return readState(node).files;
  }

  function setFiles(files) {
    writeState(node, { files });
    node.setDirtyCanvas?.(true, true);
    render();
  }

  function appendNames(names) {
    const result = appendWithinLimit(getFiles(), names, MAX_IMAGES);
    if (result.addedCount > 0) setFiles(result.paths);
    if (result.skippedCount > 0) {
      showToast(
        `MiniMax H3 accepts up to ${MAX_IMAGES} reference images. ` +
        `${result.skippedCount} image${result.skippedCount === 1 ? " was" : "s were"} not added.`
      );
    }
    return result;
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length) return;
    const remaining = Math.max(0, MAX_IMAGES - getFiles().length);
    if (remaining <= 0) {
      showToast(
        `MiniMax H3 accepts up to ${MAX_IMAGES} reference images. ` +
        `${files.length} image${files.length === 1 ? " was" : "s were"} not added.`
      );
      return;
    }
    const take = files.slice(0, remaining);
    const limitSkip = files.length - take.length;
    const uploaded = [];
    let failed = 0;
    for (const file of take) {
      try {
        uploaded.push(await uploadImage(file));
      } catch (_e) {
        failed += 1;
      }
    }
    if (uploaded.length) appendNames(uploaded);
    const notices = [];
    if (limitSkip > 0) {
      notices.push(
        `MiniMax H3 accepts up to ${MAX_IMAGES} reference images. ` +
        `${limitSkip} image${limitSkip === 1 ? " was" : "s were"} not added.`
      );
    }
    if (failed > 0) {
      notices.push(`${failed} image${failed === 1 ? "" : "s"} could not be uploaded.`);
    }
    if (notices.length) showToast(notices.join(" "));
  }

  function createPlaceholder(ref) {
    const el = document.createElement("div");
    el.className = "ph";
    el.style.width = ref?.style?.width || `${CARD_PREVIEW_H}px`;
    el.style.aspectRatio = ref?.style?.aspectRatio || "1 / 1";
    el.style.flex = "0 0 auto";
    return el;
  }

  function buildCard(path, index) {
    const layout = cardLayout(1, 1);
    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.path = path;
    card.style.width = `${layout.width}px`;
    card.style.aspectRatio = layout.aspectRatio;

    const img = document.createElement("img");
    img.decoding = "async";
    img.alt = path;
    img.src = imageFileUrl(path);
    img.addEventListener("load", () => {
      const next = cardLayout(img.naturalWidth, img.naturalHeight);
      card.style.width = `${next.width}px`;
      card.style.aspectRatio = next.aspectRatio;
    });

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = String(index + 1);

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "rm";
    rm.textContent = "×";
    rm.title = "Remove";
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = getFiles().slice();
      next.splice(index, 1);
      setFiles(next);
    });

    card.addEventListener("dragstart", () => {
      draggedCard = card;
      placeholder = createPlaceholder(card);
      isReordering = true;
      card.style.opacity = "0.35";
      setTimeout(() => {
        if (card.parentElement) card.parentElement.insertBefore(placeholder, card.nextSibling);
      }, 0);
    });

    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
      if (placeholder?.parentElement && draggedCard) {
        placeholder.parentElement.insertBefore(draggedCard, placeholder);
      }
      placeholder?.remove();
      placeholder = null;
      draggedCard = null;
      isReordering = false;
      const order = Array.from(grid.children)
        .filter((c) => c.dataset?.path)
        .map((c) => c.dataset.path);
      setFiles(order);
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggedCard || draggedCard === card || !placeholder) return;
      const rect = card.getBoundingClientRect();
      const insertAfter = e.clientX > rect.left + rect.width * 0.4;
      grid.insertBefore(placeholder, insertAfter ? card.nextSibling : card);
    });

    card.append(img, rm, badge);
    return card;
  }

  function render() {
    root.style.setProperty("--at-acc", accentOf(node));
    const files = getFiles();
    count.textContent = `${files.length} / ${MAX_IMAGES} images`;
    if (!files.length) {
      grid.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Drop reference images here";
      grid.appendChild(empty);
      return;
    }
    if (isReordering) return;
    grid.replaceChildren(...files.map((path, i) => buildCard(path, i)));
  }

  uploadBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    await uploadFiles(fileInput.files);
    fileInput.value = "";
  });

  folderBtn.addEventListener("click", () => {
    openFolderPicker(node, folderBtn, (name) => appendNames([name]));
  });

  clearBtn.addEventListener("click", () => {
    if (!getFiles().length) return;
    setFiles([]);
  });

  root.addEventListener("dragenter", (e) => {
    if (isReordering) return;
    e.preventDefault();
    dragDepth += 1;
    root.classList.add("drag");
  });
  root.addEventListener("dragleave", () => {
    if (isReordering) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) root.classList.remove("drag");
  });
  root.addEventListener("dragover", (e) => {
    if (isReordering) return;
    e.preventDefault();
  });
  root.addEventListener("drop", async (e) => {
    if (isReordering) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    root.classList.remove("drag");
    await uploadFiles(e.dataTransfer?.files);
  });

  root.addEventListener("paste", async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (isImageFile(f)) files.push(f);
      }
    }
    if (!files.length) return;
    e.preventDefault();
    await uploadFiles(files);
  });

  node._atMrRender = render;
  node._atMrRoot = root;
  render();
  return root;
}

export function renderFace(node) {
  node?._atMrRender?.();
}

export function destroyFace(node) {
  closePopup();
  if (node) {
    node._atMrRender = null;
    node._atMrRoot = null;
  }
}
