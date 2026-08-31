import { app } from "/scripts/app.js";
import { installGraphPromptHook, onGraphToPrompt } from "../shared/graph_prompt.mjs";
import { installArtThreadsChangeNet } from "../shared/graph_changed.mjs";

const GOOD_AUX = "arty-ux/ComfyUI-ArtThreads";
const GOOD_CNR = "ComfyUI-ArtThreads";

const AUX_SHAPE = /^[^/]+\/[^/]+$/;
const GITHUB_USER = /^(?!-)(?!.*--)[a-zA-Z0-9-]+(?<!-)$/;
const GIT_HASH = /^[0-9a-f]{4,40}$/i;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-z-]+(?:\.[\da-z-]+)*))?(?:\+([\da-z-]+(?:\.[\da-z-]+)*))?$/;
const CNR_SHAPE = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

const OUR_TYPES = new Set();

function isOurs(entry) {
  if (OUR_TYPES.has(entry?.type)) return true;
  const cnr = entry?.properties?.cnr_id;
  if (typeof cnr === "string" && /artthreads/i.test(cnr)) return true;
  const aux = entry?.properties?.aux_id;
  return typeof aux === "string" && /artthreads/i.test(aux);
}

function validVer(v) {
  if (typeof v !== "string") return false;
  if (v === "unknown") return true;
  const s = v.replace(/^v/, "");
  return SEMVER.test(s) || GIT_HASH.test(s);
}

function validCnr(v) {
  return (
    typeof v === "string" &&
    v.length >= 1 &&
    v.length <= 100 &&
    CNR_SHAPE.test(v) &&
    !/^[_\-.]|[_\-.]$/.test(v)
  );
}

function validAux(v) {
  if (typeof v !== "string" || !AUX_SHAPE.test(v)) return false;
  const cut = v.indexOf("/");
  const user = v.slice(0, cut);
  const repo = v.slice(cut + 1);
  return user.length >= 1 && user.length <= 39 && GITHUB_USER.test(user) && validCnr(repo);
}

function normalizePackMetadata(workflow) {
  let fixed = 0;
  const nodes = workflow?.nodes;
  if (!Array.isArray(nodes)) return fixed;
  for (const entry of nodes) {
    const p = entry?.properties;
    if (!p || typeof p !== "object" || !isOurs(entry)) continue;

    if ("aux_id" in p && !validAux(p.aux_id)) {
      p.aux_id = GOOD_AUX;
      fixed++;
    }
    if ("cnr_id" in p && !validCnr(p.cnr_id)) {
      p.cnr_id = GOOD_CNR;
      fixed++;
    } else if (!("cnr_id" in p)) {
      p.cnr_id = GOOD_CNR;
      fixed++;
    }
    if ("ver" in p && !validVer(p.ver)) {
      p.ver = "unknown";
      fixed++;
    }
  }
  return fixed;
}

onGraphToPrompt((result) => {
  try {
    normalizePackMetadata(result?.workflow);
  } catch (e) {
    console.warn("[ArtThreads] workflow metadata normalize failed (harmless):", e);
  }
});

app.registerExtension({
  name: "ArtThreads.WorkflowCompat",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    const cat = nodeData?.category;
    if (typeof cat === "string" && cat.startsWith("ArtThreads")) {
      const name = nodeData?.name || nodeType?.comfyClass;
      if (name) OUR_TYPES.add(name);
    }
  },

  setup() {
    installGraphPromptHook();
    installArtThreadsChangeNet();
  },
});
