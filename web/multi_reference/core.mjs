// Multi Reference ArtThreads — state.

export const CLASS = "ArtThreadsMultiReference";
export const HIDDEN_INPUT = "MultiReferenceState";
export const STATE_PROP = "multiReferenceState";
export const MAX_IMAGES = 9;

export const MIN_W = 320;
export const DEFAULT_W = 420;
export const MIN_H = 260;
export const DEFAULT_H = 320;
export const WIDGET_MIN_H = 220;
export const CARD_PREVIEW_H = 96;

export const DEFAULT_STATE = {
  files: [],
};

export function readState(node) {
  const raw = node?.properties?.[STATE_PROP];
  const files = Array.isArray(raw?.files) ? raw.files : [];
  const out = [];
  for (const item of files) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return { files: out.slice(0, MAX_IMAGES) };
}

export function writeState(node, patch) {
  if (!node) return DEFAULT_STATE;
  const cur = readState(node);
  let files = cur.files;
  if (patch && Array.isArray(patch.files)) {
    files = [];
    for (const item of patch.files) {
      if (typeof item === "string" && item.trim()) files.push(item.trim());
    }
  }
  const next = { files: files.slice(0, MAX_IMAGES) };
  node.properties = node.properties || {};
  node.properties[STATE_PROP] = next;
  return next;
}

export function injectedState(node) {
  return readState(node);
}

export function appendWithinLimit(current, added, max = MAX_IMAGES) {
  const paths = Array.isArray(current) ? [...current] : [];
  const seen = new Set(paths);
  let addedCount = 0;
  let skippedCount = 0;
  for (const name of added || []) {
    if (!name || seen.has(name)) continue;
    if (paths.length >= max) {
      skippedCount += 1;
      continue;
    }
    paths.push(name);
    seen.add(name);
    addedCount += 1;
  }
  return { paths, addedCount, skippedCount };
}
