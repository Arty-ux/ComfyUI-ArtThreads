// Prompt Mentions — discover Picture/Audio/Video refs from the H3 Fixed Audio Refs chain.

import { app } from "/scripts/app.js";
import { imageFileUrl } from "../multi_reference/api.mjs";
import { readState as readMultiRef } from "../multi_reference/core.mjs";
import { readState as readLoadAudio } from "../load_audio/core.mjs";
import {
  REF_TO_IMAGE_CLASS,
  REF_TO_IMAGE_MAX_QUALITY_CLASS,
  CONDITIONING_CLASSES,
  LTX_UNPACK_CLASS,
  MULTIREF_BRIDGE_CLASSES,
  MULTIREF_CLASS,
  LOAD_AUDIO_CLASS,
  AUTO_AUDIO_CLASS,
  displayLabel,
  officialType,
} from "./core.mjs";

function activeGraph() {
  return app.graph || app.rootGraph;
}

function nodeClass(node) {
  return node?.comfyClass || node?.type || "";
}

/**
 * Comfy/LiteGraph bypass: NEVER is 2 (classic) or 4 (ComfyUI).
 * Coerce mode — some builds store it as a string.
 */
export function isNodeActive(node) {
  if (!node) return false;
  const mode = Number(node.mode ?? 0);
  if (!Number.isFinite(mode)) return true;
  return mode !== 2 && mode !== 4;
}

function findInput(node, name) {
  return (node?.inputs || []).find((i) => i && i.name === name) || null;
}

function resolveLink(graph, linkId) {
  if (linkId == null || !graph) return null;
  let link = graph.links?.[linkId];
  if (!link && typeof graph.links?.get === "function") {
    link = graph.links.get(linkId);
  }
  if (!link && Array.isArray(graph.links)) {
    link = graph.links.find((l) => l && (l.id === linkId || l[0] === linkId)) || null;
  }
  return link || null;
}

function linkOriginId(link) {
  if (!link) return null;
  if (Array.isArray(link)) return link[1];
  return link.origin_id ?? link.originId ?? null;
}

function linkTargetId(link) {
  if (!link) return null;
  if (Array.isArray(link)) return link[3];
  return link.target_id ?? link.targetId ?? null;
}

function linkTargetSlot(link) {
  if (!link) return null;
  if (Array.isArray(link)) return link[4];
  return link.target_slot ?? link.targetSlot ?? null;
}

function getNodeById(graph, id) {
  if (!graph || id == null) return null;
  const n = graph.getNodeById?.(id);
  if (n) return n;
  if (typeof id === "string" && /^\d+$/.test(id)) return graph.getNodeById?.(Number(id)) || null;
  if (typeof id === "number") return graph.getNodeById?.(String(id)) || null;
  return null;
}

function linkedOrigin(node, inputName) {
  const input = findInput(node, inputName);
  if (!input || input.link == null) return null;
  const graph = node.graph || activeGraph();
  const link = resolveLink(graph, input.link);
  const originId = linkOriginId(link);
  return getNodeById(graph, originId);
}

/** Find which node feeds a named input, including Map-style link tables. */
function linkedOriginBySlot(node, slotIndex) {
  if (!node || slotIndex == null) return null;
  const graph = node.graph || activeGraph();
  const input = node.inputs?.[slotIndex];
  if (input?.link != null) {
    const link = resolveLink(graph, input.link);
    return getNodeById(graph, linkOriginId(link));
  }
  // Scan all links for target → this node/slot (Vue / Map fallbacks).
  const links = graph?.links;
  if (!links) return null;
  const visit = (link) => {
    if (!link) return null;
    if (linkTargetId(link) != node.id && String(linkTargetId(link)) !== String(node.id)) return null;
    if (linkTargetSlot(link) !== slotIndex) return null;
    return getNodeById(graph, linkOriginId(link));
  };
  if (typeof links.get === "function" && typeof links.values === "function") {
    for (const link of links.values()) {
      const n = visit(link);
      if (n) return n;
    }
  } else if (Array.isArray(links)) {
    for (const link of links) {
      const n = visit(link);
      if (n) return n;
    }
  } else {
    for (const key of Object.keys(links)) {
      const n = visit(links[key]);
      if (n) return n;
    }
  }
  return null;
}

function walkUpstream(node, maxDepth = 8) {
  const out = [];
  let cur = node;
  for (let i = 0; i < maxDepth && cur; i += 1) {
    out.push(cur);
    const first = (cur.inputs || []).find((inp) => inp && inp.link != null);
    if (!first) break;
    cur = linkedOrigin(cur, first.name);
  }
  return out;
}

function isConditioningClass(cls) {
  return CONDITIONING_CLASSES.includes(cls);
}

/** Prefer the conditioning node wired from Prompt Mentions; fall back to graph scan. */
function findConditioningNode(promptNode) {
  const graph = promptNode?.graph || activeGraph();
  if (!graph) return null;

  const out = promptNode?.outputs?.[0];
  const links = out?.links || [];
  for (const linkId of links) {
    const link = resolveLink(graph, linkId);
    if (!link) continue;
    const target = getNodeById(graph, linkTargetId(link));
    if (isConditioningClass(nodeClass(target))) return target;
  }

  const nodes = graph._nodes || graph.nodes || [];
  let fallback = null;
  for (const n of nodes) {
    const cls = nodeClass(n);
    if (!isConditioningClass(cls)) continue;
    // Prefer image still conditioning when both exist on the same graph.
    if (cls === REF_TO_IMAGE_MAX_QUALITY_CLASS || cls === REF_TO_IMAGE_CLASS) return n;
    if (!fallback) fallback = n;
  }
  return fallback;
}

/** @deprecated name kept for local call sites; resolves Fixed Audio or Ref→Image. */
function findFixedAudioRefs(promptNode) {
  return findConditioningNode(promptNode);
}

function multiRefFromBridge(bridge) {
  if (!bridge) return null;
  for (const name of ["artthreads_ref_images", "ref_images"]) {
    const origin = linkedOrigin(bridge, name);
    if (!origin) continue;
    if (nodeClass(origin) === MULTIREF_CLASS) return origin;
    for (const n of walkUpstream(origin)) {
      if (nodeClass(n) === MULTIREF_CLASS) return n;
    }
  }
  return null;
}

function findMultiRef(bridge, graph) {
  const fromBridge = multiRefFromBridge(bridge);
  if (fromBridge) return fromBridge;

  const g = graph || bridge?.graph || activeGraph();
  const nodes = g?._nodes || g?.nodes || [];

  // LTX still graphs: Prompt Mentions → CLIPTextEncode (no H3 cond). Prefer unpack → MultiRef.
  for (const n of nodes) {
    if (nodeClass(n) !== LTX_UNPACK_CLASS) continue;
    const viaUnpack = multiRefFromBridge(n);
    if (viaUnpack) return viaUnpack;
  }
  for (const n of nodes) {
    if (nodeClass(n) === MULTIREF_CLASS) return n;
  }
  return null;
}

function resolveLoadAudio(origin) {
  if (!origin) return null;
  if (nodeClass(origin) === LOAD_AUDIO_CLASS) return origin;
  for (const n of walkUpstream(origin)) {
    if (nodeClass(n) === LOAD_AUDIO_CLASS) return n;
  }
  return null;
}

function sourceAudioAsset(graph) {
  if (!graph) return null;
  const nodes = graph._nodes || graph.nodes || [];
  let auto = null;
  for (const n of nodes) {
    if (nodeClass(n) === AUTO_AUDIO_CLASS) {
      auto = n;
      break;
    }
  }
  if (!auto) return null;

  let origin = linkedOrigin(auto, "source_audio");
  if (!origin) {
    const slot = (auto.inputs || []).findIndex((inp) => inp && inp.name === "source_audio");
    if (slot >= 0) origin = linkedOriginBySlot(auto, slot);
  }
  if (!origin) return null;

  const loadNode = resolveLoadAudio(origin);
  if (!isNodeActive(loadNode || origin)) return null;

  const st = loadNode ? readLoadAudio(loadNode) : null;
  const file = st?.file || "";
  const title = (loadNode?.title || "").replace(/^\d+\.\s*/, "").trim();
  return {
    id: "source-audio",
    kind: "Source",
    ordinal: 0,
    label: displayLabel("Source", 0),
    file,
    title: title || file || "Source Audio",
    thumb: "",
    nodeId: loadNode?.id ?? origin.id,
  };
}

function audioAssetsFromFixed(fixed) {
  const assets = [];
  if (!fixed) return assets;
  for (let i = 0; i < 3; i += 1) {
    const inputName = `ref_audio_${i}`;
    let origin = linkedOrigin(fixed, inputName);
    if (!origin) {
      const slot = (fixed.inputs || []).findIndex((inp) => inp && inp.name === inputName);
      if (slot >= 0) origin = linkedOriginBySlot(fixed, slot);
    }
    if (!origin) continue;
    const loadNode = resolveLoadAudio(origin);
    // Bypassed / muted Load Audio stays wired but is not an active @ ref.
    if (!isNodeActive(loadNode || origin)) continue;
    const ordinal = i + 1;
    const st = loadNode ? readLoadAudio(loadNode) : null;
    const file = st?.file || "";
    const title = (loadNode?.title || "").replace(/^\d+\.\s*/, "").trim();
    assets.push({
      id: `audio-${ordinal}`,
      kind: "Audio",
      ordinal,
      label: displayLabel("Audio", ordinal),
      file,
      title: title || file || `Audio ${ordinal}`,
      thumb: "",
      nodeId: loadNode?.id ?? origin.id,
    });
  }
  return assets;
}

function videoAssetsFromFixed(fixed) {
  const assets = [];
  if (!fixed) return assets;
  let origin = linkedOrigin(fixed, "ref_video_0");
  if (!origin) {
    const slot = (fixed.inputs || []).findIndex((inp) => inp && inp.name === "ref_video_0");
    if (slot >= 0) origin = linkedOriginBySlot(fixed, slot);
  }
  if (!origin || !isNodeActive(origin)) return assets;
  assets.push({
    id: "video-1",
    kind: "Video",
    ordinal: 1,
    label: displayLabel("Video", 1),
    file: "",
    title: origin.title || "Video 1",
    thumb: "",
    nodeId: origin.id,
  });
  return assets;
}

function pictureAssetsFromMulti(multi) {
  const assets = [];
  if (!multi || !isNodeActive(multi)) return assets;
  const files = readMultiRef(multi).files || [];
  files.forEach((file, idx) => {
    const ordinal = idx + 1;
    assets.push({
      id: `picture-${ordinal}`,
      kind: "Picture",
      ordinal,
      label: displayLabel("Picture", ordinal),
      file,
      title: file.split("/").pop() || `Image ${ordinal}`,
      thumb: imageFileUrl(file),
      nodeId: multi.id,
    });
  });
  return assets;
}

/**
 * Collect mentionable assets for a Prompt Mentions node.
 * @returns {{ assets: object[], fixed: object|null, multi: object|null }}
 */
export function discoverAssets(promptNode) {
  const graph = promptNode?.graph || activeGraph();
  const fixed = findFixedAudioRefs(promptNode);
  // Prefer H3 conditioning bridge; otherwise any MultiRef bridge (incl. LTX unpack) on the graph.
  let bridge = fixed;
  if (!bridge) {
    const nodes = graph?._nodes || graph?.nodes || [];
    bridge = nodes.find((n) => MULTIREF_BRIDGE_CLASSES.includes(nodeClass(n))) || null;
  }
  const multi = findMultiRef(bridge, graph);
  const pictures = pictureAssetsFromMulti(multi);
  const source = sourceAudioAsset(fixed?.graph || graph);
  const audios = audioAssetsFromFixed(fixed);
  const videos = videoAssetsFromFixed(fixed);
  return {
    assets: [...pictures, ...(source ? [source] : []), ...audios, ...videos],
    fixed,
    multi,
    source,
  };
}

export function assetKey(list) {
  return (list || [])
    .map((a) => `${a.kind}:${a.ordinal}:${a.file || ""}:${a.nodeId || ""}`)
    .join("|");
}

export function activeMentionKeys(assets) {
  const keys = new Set();
  for (const a of assets || []) {
    keys.add(`${a.kind}:${a.ordinal}`);
  }
  return keys;
}

export { officialType, displayLabel };
