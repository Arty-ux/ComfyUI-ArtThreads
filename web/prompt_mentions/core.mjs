// Prompt Mentions ArtThreads — token helpers (pure).

export const CLASS = "ArtThreadsPromptMentions";
export const FIXED_AUDIO_CLASS = "DenoMiniMaxH3ReferenceToVideoFixedAudioRefs";
export const MULTIREF_CLASS = "ArtThreadsMultiReference";
export const LOAD_AUDIO_CLASS = "ArtThreadsLoadAudio";
export const AUTO_AUDIO_CLASS = "H3AutoAudioControl";

export const MIN_W = 360;
export const DEFAULT_W = 500;
export const MIN_H = 280;
export const DEFAULT_H = 420;
export const WIDGET_MIN_H = 240;

export const SOURCE_TAG = "<Source Audio>";
export const AT_PARTIAL_RE = /@\s*([A-Za-z]*)\s*(\d*)$/;

export function officialType(mediaType) {
  const kind = String(mediaType || "").toLowerCase();
  if (kind === "source") return "Source";
  if (kind === "image" || kind === "picture") return "Picture";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return "Picture";
}

export function displayLabel(kind, ordinal) {
  const k = officialType(kind);
  if (k === "Source") return "Source Audio";
  if (k === "Picture") return `Image ${ordinal}`;
  return `${k} ${ordinal}`;
}

export function tagFor(kind, ordinal) {
  if (officialType(kind) === "Source") return SOURCE_TAG;
  return `<${officialType(kind)} ${Number(ordinal)}>`;
}

/** Convert @Image 1 / loose Image 1 forms to <Picture 1>. */
export function canonicalizeText(prompt) {
  let text = typeof prompt === "string" ? prompt : "";
  text = text.replace(/@\s*Source\s*Audio\b/gi, SOURCE_TAG);
  text = text.replace(/<\s*Source\s*Audio\s*>/gi, SOURCE_TAG);
  text = text.replace(/@\s*(Image|Picture|Video|Audio)\s*(\d+)\b/gi, (_, t, n) => tagFor(t, n));
  text = text.replace(
    /<\s*(Image|Picture|Video|Audio)\s*(\d+)\s*>|(?<![\w<])(Image|Picture|Video|Audio)\s*#?\s*(\d+)\b(?!\s*>)/gi,
    (full, a, b, c, d) => tagFor(a || c, b || d),
  );
  return text;
}

/**
 * Find mention spans for highlight. Returns {start,end,kind,ordinal,raw}[].
 */
export function scanMentions(text) {
  const out = [];
  if (typeof text !== "string" || !text) return out;
  const re = /<\s*Source\s*Audio\s*>|<\s*(Image|Picture|Video|Audio)\s*(\d+)\s*>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (/^<\s*Source\s*Audio\s*>$/i.test(m[0])) {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        kind: "Source",
        ordinal: 0,
        raw: m[0],
      });
      continue;
    }
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      kind: officialType(m[1]),
      ordinal: parseInt(m[2], 10),
      raw: m[0],
    });
  }
  return out;
}

export function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {string} text
 * @param {Set<string>|null} activeKeys - keys like "Audio:2"; missing = inactive chip
 */
export function backdropHTML(text, activeKeys = null) {
  if (typeof text !== "string") text = "";
  const toks = scanMentions(text);
  let html = "";
  let i = 0;
  for (const h of toks) {
    html += escapeHTML(text.slice(i, h.start));
    const live = !activeKeys || activeKeys.has(`${h.kind}:${h.ordinal}`);
    let cls = "at-pm-chip";
    if (h.kind === "Audio" || h.kind === "Source") cls += " audio";
    else if (h.kind === "Video") cls += " video";
    if (!live) cls += " off";
    html += `<span class="${cls}" data-kind="${h.kind}" data-ord="${h.ordinal}">${escapeHTML(h.raw)}</span>`;
    i = h.end;
  }
  html += escapeHTML(text.slice(i));
  if (text.endsWith("\n")) html += " ";
  return html;
}

/** Active @ query at caret: {start, query} or null. */
export function atQueryAt(text, caret) {
  const upto = String(text || "").slice(0, caret);
  const m = AT_PARTIAL_RE.exec(upto);
  if (!m) return null;
  const start = caret - m[0].length;
  if (start > 0) {
    const prev = upto[start - 1];
    if (prev && /[\w@]/.test(prev)) return null;
  }
  const q = `${m[1] || ""}${m[2] ? " " + m[2] : ""}`.trim().toLowerCase();
  return { start, query: q, raw: m[0] };
}

export function filterAssets(assets, query) {
  const list = Array.isArray(assets) ? assets : [];
  const q = String(query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter((a) => {
    const hay = `${a.label} ${a.kind} ${a.ordinal} ${a.file || ""}`.toLowerCase();
    return hay.includes(q) || `@${a.label}`.toLowerCase().includes(q);
  });
}

export function syncColumns(ta, bd) {
  if (!ta || !bd || !ta.isConnected) return;
  bd.style.paddingRight = "";
  bd.style.width = "";
  const cs = getComputedStyle(ta);
  const bs = getComputedStyle(bd);
  const taText = ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const padR = parseFloat(bs.paddingRight);
  const bdText = bd.clientWidth - parseFloat(bs.paddingLeft) - padR;
  if (!(taText > 0) || !(bdText > 0)) return;
  const gap = bdText - taText;
  if (Math.abs(gap) < 0.5) return;
  if (padR + gap >= 0) bd.style.paddingRight = padR + gap + "px";
  else bd.style.width = Math.max(0, bd.offsetWidth - gap) + "px";
}
