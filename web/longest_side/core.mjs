// Longest Side / Video Size ArtThreads — shared state and browser math mirror.

export const CLASS_NAMES = ["ArtThreadsLongestSide", "ArtThreadsVideoSize"];

export const STEPS = [0, 8, 16, 32, 64];
export const MIN_DIM = 8;
export const MAX_DIM = 16384;
export const MAX_ROW_ITEMS = 5;
export const LOCKED_RATIO = "keep";

export const ANCHORS = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
];

export const RESAMPLES = ["auto", "lanczos", "bicubic", "bilinear", "nearest"];

export const RATIO_CHOICES = [
  "keep", "1:1", "16:9", "9:16", "4:3", "3:4",
  "3:2", "2:3", "5:4", "4:5", "21:9", "9:21", "2:1", "1:2",
];

const LS_SIZES = [1024, 1216, 1344, 1536, 2048];
const LS_RATIOS = ["keep", "1:1", "16:9", "9:16", "2:3"];
const VS_SIZES = [640, 768, 896, 1024, 1216];
const VS_RATIOS = ["16:9", "9:16", "1:1", "4:3", "keep"];

export const NODE_CONFIG = {
  ArtThreadsLongestSide: {
    stateProp: "longestSideState",
    hiddenInput: "LongestSideState",
    videoSize: false,
    defaultSizes: LS_SIZES,
    defaultRatios: LS_RATIOS,
    defaults: {
      size: 1344,
      ratio: "keep",
      step: 32,
      anchor: "center",
      allow_upscale: true,
      resample: "auto",
    },
    settingsTitle: "Longest Side settings",
    gearTitle: "Longest Side settings",
    widgetName: "artthreads_longest_side_ui",
  },
  ArtThreadsVideoSize: {
    stateProp: "videoSizeState",
    hiddenInput: "VideoSizeState",
    videoSize: true,
    defaultSizes: VS_SIZES,
    defaultRatios: VS_RATIOS,
    defaults: {
      size: 896,
      ratio: "16:9",
      step: 32,
      anchor: "center",
      allow_upscale: true,
      resample: "auto",
    },
    settingsTitle: "Video Size settings",
    gearTitle: "Video Size settings",
    widgetName: "artthreads_video_size_ui",
  },
};

const UI_ONLY_KEYS = ["sizes", "ratios"];

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(n, hi));
};

export function nodeConfig(node) {
  return NODE_CONFIG[node?.comfyClass] || NODE_CONFIG.ArtThreadsLongestSide;
}

export function readState(node) {
  const cfg = nodeConfig(node);
  const raw = node?.properties?.[cfg.stateProp];
  const d = raw && typeof raw === "object" ? raw : {};

  const sizes = Array.isArray(d.sizes) && d.sizes.length
    ? d.sizes.map((v) => clampInt(v, MIN_DIM, MAX_DIM, 1024)).slice(0, MAX_ROW_ITEMS)
    : [...cfg.defaultSizes];

  const stored = Array.isArray(d.ratios)
    ? d.ratios.filter((r) => typeof r === "string" && r.trim() && r !== LOCKED_RATIO)
    : [...cfg.defaultRatios].filter((r) => r !== LOCKED_RATIO);
  const ratios = cfg.videoSize
    ? [...new Set([...cfg.defaultRatios.filter((r) => r !== LOCKED_RATIO), ...stored])].slice(0, MAX_ROW_ITEMS)
    : [LOCKED_RATIO, ...stored].slice(0, MAX_ROW_ITEMS);

  const step = Number(d.step);
  let ratio = typeof d.ratio === "string" && d.ratio.trim() ? d.ratio : cfg.defaults.ratio;
  if (!ratios.includes(ratio)) ratio = cfg.videoSize ? ratios[0] || "16:9" : LOCKED_RATIO;

  return {
    size: clampInt(d.size, MIN_DIM, MAX_DIM, cfg.defaults.size),
    sizes,
    ratio,
    ratios,
    step: STEPS.includes(step) ? step : cfg.defaults.step ?? 0,
    anchor: ANCHORS.includes(d.anchor) ? d.anchor : cfg.defaults.anchor,
    allow_upscale: d.allow_upscale === undefined ? cfg.defaults.allow_upscale : !!d.allow_upscale,
    resample: RESAMPLES.includes(d.resample) ? d.resample : cfg.defaults.resample,
  };
}

export function writeState(node, patch) {
  if (!node) return readState(node);
  const cfg = nodeConfig(node);
  const next = { ...readState(node), ...(patch || {}) };
  node.properties = node.properties || {};
  node.properties[cfg.stateProp] = next;
  return readState(node);
}

export function runState(node) {
  const st = readState(node);
  const out = {};
  for (const k of Object.keys(st)) if (!UI_ONLY_KEYS.includes(k)) out[k] = st[k];
  return out;
}

export function nextStep(current) {
  const i = STEPS.indexOf(Number(current));
  return STEPS[(i < 0 ? 0 : i + 1) % STEPS.length];
}

export function stepLabel(s) {
  return Number(s) > 0 ? `x${s}` : "Off";
}

function roundDiv(a, b) {
  const bi = Math.trunc(b);
  if (!bi) return 0;
  return Math.floor((Math.trunc(a) + Math.floor(bi / 2)) / bi);
}

export function snapToMultiple(value, multiple) {
  const v = Math.trunc(Number(value));
  const m = Math.trunc(Number(multiple));
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 1) return v;
  return Math.max(m, Math.floor((v + Math.floor(m / 2)) / m) * m);
}

export function parseRatio(name) {
  if (typeof name !== "string") return null;
  const text = name.trim().toLowerCase();
  if (!text || ["keep", "off", "none", "original"].includes(text)) return null;
  for (const sep of [":", "x", "/"]) {
    const i = text.indexOf(sep);
    if (i < 0) continue;
    const rw = Math.trunc(Number(text.slice(0, i).trim()));
    const rh = Math.trunc(Number(text.slice(i + 1).trim()));
    if (Number.isFinite(rw) && Number.isFinite(rh) && rw > 0 && rh > 0) return [rw, rh];
    return null;
  }
  return null;
}

function anchorOffset(anchor, outerW, innerW, outerH, innerH) {
  const a = (anchor || "center").toLowerCase();
  let x;
  if (a.includes("left")) x = 0;
  else if (a.includes("right")) x = outerW - innerW;
  else x = Math.floor((outerW - innerW) / 2);
  let y;
  if (a.includes("top")) y = 0;
  else if (a.includes("bottom")) y = outerH - innerH;
  else y = Math.floor((outerH - innerH) / 2);
  return [Math.max(0, x), Math.max(0, y)];
}

export function cropRect(w, h, ratio, anchor = "center") {
  w = Math.trunc(w); h = Math.trunc(h);
  if (w <= 0 || h <= 0) return [0, 0, Math.max(0, w), Math.max(0, h)];
  if (!ratio) return [0, 0, w, h];
  const [rw, rh] = ratio;
  let cw, ch;
  if (w * rh > h * rw) { ch = h; cw = roundDiv(h * rw, rh); }
  else { cw = w; ch = roundDiv(w * rh, rw); }
  cw = Math.max(1, Math.min(cw, w));
  ch = Math.max(1, Math.min(ch, h));
  const [x, y] = anchorOffset(anchor, w, cw, h, ch);
  return [x, y, cw, ch];
}

export function targetSize(cw, ch, longest, allowUpscale = true) {
  cw = Math.trunc(cw); ch = Math.trunc(ch);
  if (cw <= 0 || ch <= 0) return [MIN_DIM, MIN_DIM];
  let L = Math.trunc(Number(longest));
  if (!Number.isFinite(L) || L <= 0) L = MIN_DIM;
  const srcLongest = Math.max(cw, ch);
  if (!allowUpscale && L > srcLongest) L = srcLongest;
  let outW, outH;
  if (cw >= ch) { outW = L; outH = roundDiv(L * ch, cw); }
  else { outH = L; outW = roundDiv(L * cw, ch); }
  return [Math.max(1, outW), Math.max(1, outH)];
}

function clampDims(w, h) {
  return [
    Math.max(MIN_DIM, Math.min(Math.trunc(w), MAX_DIM)),
    Math.max(MIN_DIM, Math.min(Math.trunc(h), MAX_DIM)),
  ];
}

function dimsFromRatio(longest, ratio) {
  const [rw, rh] = ratio;
  if (rw >= rh) return [longest, roundDiv(longest * rh, rw)];
  return [roundDiv(longest * rw, rh), longest];
}

/** ArtThreadsVideoSize — no source image. Mirrors lib/resize_math.compute_output_size. */
export function computeOutputSize(st) {
  const ratio = parseRatio(st.ratio) || [16, 9];
  let [w, h] = dimsFromRatio(st.size, ratio);
  if (st.step > 0) {
    w = snapToMultiple(w, st.step);
    h = snapToMultiple(h, st.step);
  }
  return clampDims(w, h);
}

export function computeSize(inW, inH, st) {
  inW = Math.trunc(inW || 0); inH = Math.trunc(inH || 0);
  if (inW <= 0 || inH <= 0) return { crop: [0, 0, 0, 0], size: [MIN_DIM, MIN_DIM] };
  const [x, y, cw, ch] = cropRect(inW, inH, parseRatio(st.ratio), st.anchor);
  let [w, h] = targetSize(cw, ch, st.size, st.allow_upscale);
  if (st.step > 0) { w = snapToMultiple(w, st.step); h = snapToMultiple(h, st.step); }
  const [fw, fh] = clampDims(w, h);
  return { crop: [x, y, cw, ch], size: [fw, fh] };
}

export function previewText(node, dims, connected = true) {
  const cfg = nodeConfig(node);
  const st = readState(node);

  if (cfg.videoSize) {
    const [w, h] = computeOutputSize(st);
    return {
      text: `${w}x${h}`,
      dim: false,
      title: `Generation size ${w} x ${h} (${st.ratio}, longest ${st.size})`,
    };
  }

  if (dims?.w > 0 && dims?.h > 0) {
    const [w, h] = computeSize(dims.w, dims.h, st).size;
    const fromRun = dims.source === "run";
    return {
      text: `${w}x${h}`,
      dim: false,
      title: fromRun
        ? `Output ${w} x ${h} from last run (${dims.w} x ${dims.h} input)`
        : `Output ${w} x ${h} from ${dims.w} x ${dims.h} input`,
    };
  }

  if (!connected) {
    return {
      text: `${st.size} long side`,
      dim: true,
      title: `Wire a picture in. Longest side will be ${st.size}.`,
    };
  }

  const ratio = parseRatio(st.ratio);
  if (ratio) {
    let [w, h] = targetSize(ratio[0], ratio[1], st.size, true);
    if (st.step > 0) { w = snapToMultiple(w, st.step); h = snapToMultiple(h, st.step); }
    return {
      text: `~${w}x${h}`,
      dim: true,
      title: `About ${w} x ${h}. Exact size needs the incoming picture.`,
    };
  }

  return {
    text: `${st.size} long side`,
    dim: true,
    title: `Longest side ${st.size}. Other side depends on input aspect.`,
  };
}
