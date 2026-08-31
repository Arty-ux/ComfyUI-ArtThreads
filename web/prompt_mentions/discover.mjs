// Prompt Mentions — discover Picture/Audio/Video refs from the H3 Fixed Audio Refs chain.

import { app } from "/scripts/app.js";
import { imageFileUrl } from "../multi_reference/api.mjs";
import { readState as readMultiRef } from "../multi_reference/core.mjs";
import { readState as readLoadAudio } from "../load_audio/core.mjs";
import {
  FIXED_AUDIO_CLASS,
  MULTIREF_CLASS,
  LOAD_AUDIO_CLASS,
  displayLabel,
  officialType,
} from "./core.mjs";

function activeGraph() {
  return app.graph || app.rootGraph;
}

function nodeClass(node) {
  return node?.comfyClass || node?.type || "";
}

function findInput(node, name) {
  return (node?.inputs || []).find((i) => i && i.name === name) || null;
}

function linkedOrigin(node, inputName) {
  const input = findInput(node, inputName);
  if (!input || input.link == null) return null;
  const graph = node.graph || activeGraph();
  const link = graph?.links?.[input.link];
  if (!link) return null;
  const originId = link.origin_id ?? link[1];
  return graph?.getNodeById?.(originId) || null;
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

function findFixedAudioRefs(promptNode) {
  const graph = promptNode?.graph || activeGraph();
  if (!graph) return null;

  const out = promptNode?.outputs?.[0];
  const links = out?.links || [];
  for (const linkId of links) {
    const link = graph.links?.[linkId];
    if (!link) continue;
    const targetId = link.target_id ?? link[3];
    const target = graph.getNodeById?.(targetId);
    if (nodeClass(target) === FIXED_AUDIO_CLASS) return target;
  }

  const nodes = graph._nodes || graph.nodes || [];
  for (const n of nodes) {
    if (nodeClass(n) === FIXED_AUDIO_CLASS) return n;
  }
  return null;
}

function findMultiRef(fixed) {
  if (!fixed) return null;
  for (const name of ["artthreads_ref_images", "ref_images"]) {
    const origin = linkedOrigin(fixed, name);
    if (!origin) continue;
    if (nodeClass(origin) === MULTIREF_CLASS) return origin;
    for (const n of walkUpstream(origin)) {
      if (nodeClass(n) === MULTIREF_CLASS) return n;
    }
  }
  const graph = fixed.graph || activeGraph();
  const nodes = graph?._nodes || graph?.nodes || [];
  for (const n of nodes) {
    if (nodeClass(n) === MULTIREF_CLASS) return n;
  }
  return null;
}

function audioAssetsFromFixed(fixed) {
  const assets = [];
  if (!fixed) return assets;
  for (let i = 0; i < 3; i += 1) {
    const origin = linkedOrigin(fixed, `ref_audio_${i}`);
    if (!origin) continue;
    let loadNode = null;
    if (nodeClass(origin) === LOAD_AUDIO_CLASS) {
      loadNode = origin;
    } else {
      for (const n of walkUpstream(origin)) {
        if (nodeClass(n) === LOAD_AUDIO_CLASS) {
          loadNode = n;
          break;
        }
      }
    }
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
  const origin = linkedOrigin(fixed, "ref_video_0");
  if (!origin) return assets;
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
  if (!multi) return assets;
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
  const fixed = findFixedAudioRefs(promptNode);
  const multi = findMultiRef(fixed);
  const pictures = pictureAssetsFromMulti(multi);
  const audios = audioAssetsFromFixed(fixed);
  const videos = videoAssetsFromFixed(fixed);
  return {
    assets: [...pictures, ...audios, ...videos],
    fixed,
    multi,
  };
}

export function assetKey(list) {
  return (list || [])
    .map((a) => `${a.kind}:${a.ordinal}:${a.file || ""}:${a.nodeId || ""}`)
    .join("|");
}

export { officialType, displayLabel };
