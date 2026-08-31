// Load Audio ArtThreads — state.

export const CLASS = "ArtThreadsLoadAudio";
export const HIDDEN_INPUT = "LoadAudioState";
export const STATE_PROP = "loadAudioState";

export const MIN_W = 300;
export const DEFAULT_W = 380;
export const WAVE_H = 62;

export const DEFAULT_STATE = {
  file: "",
  start: 0,
  length: 5,
  whenUnwired: "whole",
  whenShort: "silence",
};

const PROMPT_KEYS = ["file", "start", "length", "whenUnwired", "whenShort"];

function clampNum(value, fallback, lo, hi) {
  const out = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(out)) return fallback;
  return Math.max(lo, Math.min(hi, out));
}

export function readState(node) {
  const raw = node?.properties?.[STATE_PROP];
  const st = { ...DEFAULT_STATE, ...(raw && typeof raw === "object" ? raw : {}) };
  st.file = typeof st.file === "string" ? st.file : "";
  st.start = clampNum(st.start, 0, 0, 86400);
  st.length = clampNum(st.length, DEFAULT_STATE.length, 0, 86400);
  st.whenUnwired = st.whenUnwired === "length" ? "length" : "whole";
  st.whenShort = st.whenShort === "loop" ? "loop" : "silence";
  return st;
}

export function writeState(node, patch) {
  if (!node) return DEFAULT_STATE;
  const next = { ...readState(node), ...(patch || {}) };
  node.properties = node.properties || {};
  node.properties[STATE_PROP] = next;
  return next;
}

export function injectedState(node) {
  const st = readState(node);
  const out = {};
  for (const key of PROMPT_KEYS) out[key] = st[key];
  return out;
}

export function fmtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}
