// Read upstream image dimensions without running the graph.

import { app } from "/scripts/app.js";

/** Nodes whose preview is not their output — never measure node.imgs. */
export const PREVIEW_IS_NOT_OUTPUT = new Set([
  "ArtThreadsLoadAudio",
]);

export function upstreamImageDims(node, inputName = "image") {
  try {
    const inputs = node?.inputs || [];
    const inp = inputs.find((i) => i?.name === inputName) || inputs[0];
    if (!inp || inp.link == null) return null;

    const graph = node.graph || app.graph;
    if (!graph) return null;

    let link = graph.links?.[inp.link];
    if (!link && typeof graph.links?.get === "function") link = graph.links.get(inp.link);
    if (!link) return null;

    const up = graph.getNodeById?.(link.origin_id);
    if (!up) return null;
    if (up.mode === 2 || up.mode === 4) return null;
    if (PREVIEW_IS_NOT_OUTPUT.has(up.comfyClass)) return null;

    const imgs = up.imgs;
    if (!imgs?.length) return null;
    const img = imgs[up.imageIndex || 0] || imgs[0];
    const w = Math.trunc(img?.naturalWidth || 0);
    const h = Math.trunc(img?.naturalHeight || 0);
    if (w > 0 && h > 0) return { w, h };
  } catch {}
  return null;
}
