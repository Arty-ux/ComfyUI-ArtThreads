// Longest Side ArtThreads - wiring.
//
// One DOM widget carries the whole face, so both renderers get the same thing
// and there is nothing to rebuild when the renderer is flipped (the trap that
// bit Switch and Mute Switch). The state lives on node.properties and is pushed
// into the hidden LongestSideState input at submission time (Resolution
// pattern, Vue Compat #9), so no extra input dot appears.

import { app } from "/scripts/app.js";
import {
  applyAdaptiveCanvasOnly, isVueNodes, installResizeFloor,
  installCanvasZoomPassthrough,
} from "../shared/index.mjs";
import { isGraphLoading } from "../shared/graph_loading.mjs";
import { onRendererChange } from "../shared/renderer_switch.mjs";
import { registerPromptInjector } from "../shared/graph_prompt.mjs";
import { installNodeAccent, registerNodeSettings } from "../shared/node_settings.mjs";
import { CLASS_NAMES, NODE_CONFIG, runState, nodeConfig } from "./core.mjs?v=2";
import { inputSizeKey } from "./input_size.mjs?v=2";
import { buildFace, WIDGET_H, VIDEO_SIZE_WIDGET_H, DEFAULT_W, MIN_W } from "./ui.mjs?v=2";
import { openLongestSidePanel, closeLongestSidePanelFor } from "./settings.mjs?v=2";

const CLASS_SET = new Set(CLASS_NAMES);

for (const cls of CLASS_NAMES) {
  const cfg = NODE_CONFIG[cls];
  registerPromptInjector(cls, (node, entry) => {
    entry.inputs = entry.inputs || {};
    entry.inputs[cfg.hiddenInput] = JSON.stringify(runState(node));
  });
}

function openPanel(node) {
  openLongestSidePanel(node, (n) => {
    n._atLsRefresh?.();
    n.setDirtyCanvas?.(true, true);
  });
}

// ── where the band lives, per renderer ──────────────────────────────────────
// The band sits on the `width` / `height` slot rows, whose left half is empty.
// CLASSIC: lift it out of the widget flow with a measured offset (see ui.mjs).
// NODES 2.0: Vue clips anything above the widget top, so the lift is no use -
// park the band INSIDE the output-slot block, which is the dead-space itself,
// so it needs no offset and cannot drift if a slot moves.
//
// DOM only, wrapped in try/catch: if a future frontend defeats it, the band
// falls back to a plain row and the node still works.

function vueSlotBlock(el) {
  return el?.querySelector(".lg-slot--output")?.parentElement?.parentElement || null;
}

function parkBand(node) {
  try {
    const band = node._atLsBand;
    if (!band) return;
    const el = document.querySelector(`.lg-node[data-node-id="${node.id}"]`);
    // PROVE the element is really this node's before parking anything in it.
    // `data-node-id` is NOT page-unique: subgraph ids are local and restart at
    // 1, which is exactly why findNode() below has to strip a "12:5" prefix.
    // Once collectNodes() started feeding subgraph-resident nodes in here, a
    // bare id query could match an unrelated root node and glue this node's
    // step button and gear onto it. Containment is the cheap proof - our widget
    // root lives inside our own .lg-node and nobody else's. Bailing when the
    // root is not mounted yet is harmless: the rAF, the 150ms retry and the
    // sweep all come back.
    if (!el || !node._atLsRoot || !el.contains(node._atLsRoot)) return;
    const block = vueSlotBlock(el);
    if (!block) return;
    if (band.parentElement === block) return;   // steady state, one comparison
    block.style.position = "relative";
    block.appendChild(band);
    band.classList.add("parked");
  } catch {
    // Degrades to an IN-FLOW row, not a tidy one: WIDGET_H deliberately
    // excludes the band's height, so a permanent park failure (a future
    // frontend renaming .lg-slot--output) would clip the chip row rather than
    // simply moving it. Making the height hooks vary with DOM state is not the
    // answer - a measured height is what rewrites node.size and false-dirties
    // workflows. Saying so here so nobody "fixes" it that way.
  }
}

function applyBandPlacement(node) {
  const band = node._atLsBand;
  if (!band) return;
  if (nodeConfig(node).videoSize) {
    band.classList.remove("classic", "parked");
    const root = node._atLsRoot;
    if (root && band.parentElement !== root) root.insertBefore(band, root.firstChild);
    return;
  }
  const classic = !isVueNodes();
  band.classList.toggle("classic", classic);
  if (classic) {
    // Coming back from Nodes 2.0 the band is still parked in a slot block that
    // does not exist in Classic - put it back at the top of our own root.
    band.classList.remove("parked");
    const root = node._atLsRoot;
    if (root && band.parentElement !== root) root.insertBefore(band, root.firstChild);
  } else {
    parkBand(node);
    // Retry immediately as well as on the 350ms sweep. On a fresh node the
    // .lg-node element does not exist yet when this first runs, so parkBand
    // bails - and until it lands the band is a normal 40px row inside a widget
    // pinned to 66px, which pushes the chip row out of the box. Waiting a whole
    // sweep tick for that makes it a visible flash on every drop and every Vue
    // re-render. parkBand is idempotent, so the extra calls cost nothing.
    requestAnimationFrame(() => parkBand(node));
    setTimeout(() => parkBand(node), 150);
  }
}

// Vue REPLACES the node element on re-render, orphaning the parked band, and it
// can add the slots a frame late, so re-parking has to be a poll. That poll is
// the shared watchdog below (sweep), not a per-node timer.

const WIDGET_NAME = "artthreads_longest_side_ui"; // legacy alias; use nodeConfig(node).widgetName

/** Is this node's face actually present and ours? */
function faceAlive(node) {
  const wname = nodeConfig(node).widgetName;
  return !!node._atLsRoot && (node.widgets || []).some((w) => w.name === wname);
}

/** Drop whatever is left of a face so it can be rebuilt from scratch. */
function teardownFace(node) {
  node._atLsFloorOff?.();
  node._atLsFloorOff = null;
  try { node._atLsBand?.remove(); } catch {}
  try { node._atLsRoot?.remove(); } catch {}
  const wname = nodeConfig(node).widgetName;
  const i = (node.widgets || []).findIndex((w) => w.name === wname);
  if (i >= 0) {
    // Splice AND onRemove. Removing our own element drops what WE made, but
    // ComfyUI created a wrapper and a registration of its own in addDOMWidget
    // and only onRemove releases those. Without it every renderer flip and
    // every node delete left an orphan behind, and this function runs on both.
    // Same order as js/switch/vue_list.mjs, js/mute_switch/vue_list.mjs and
    // js/sliders/ui.mjs; try/catch because the element may already be detached.
    const w = node.widgets[i];
    node.widgets.splice(i, 1);
    try { w?.onRemove?.(); } catch { /* already detached */ }
  }
  node._atLsBand = null;
  node._atLsRoot = null;
  node._atLsRefresh = null;
}

/**
 * IDEMPOTENT. Builds the face only if it is missing, so it is safe to call from
 * a poll.
 *
 * Flipping "Modern Node Design" live does NOT just move things around: measured
 * on this node, the flip left it with `widgets: []` and no face at all, because
 * the widget is created once in nodeCreated and the flip tears the node down
 * without running it again. ComfyUI marks that setting with no reload flag, so
 * nobody is told to refresh, and core's own nodes re-render in place - people
 * reasonably expect ours to as well.
 */
function ensureFace(node) {
  if (faceAlive(node)) return false;
  teardownFace(node);            // clear any half-built leftovers first
  buildFaceOnNode(node);
  return true;
}

function buildFaceOnNode(node) {
  const { root, band, refresh } = buildFace(node, { onGear: openPanel });
  node._atLsRoot = root;
  node._atLsBand = band;
  node._atLsRefresh = refresh;

  applyBandPlacement(node);

  // MANDATORY on every DOM widget: without it the wheel is swallowed by this
  // element and the canvas stops zooming while the cursor is over the node
  // (UI convention #17). No-op in Nodes 2.0, which forwards it itself.
  installCanvasZoomPassthrough(root);
  // BOTH root and band. installNodeAccent writes --at-acc inline on each
  // element it is given, and in Nodes 2.0 the band is moved OUT of root into
  // the slot block, so it stops inheriting the variable: measured, the tabs and
  // chips followed a custom accent while the step button and the size readout
  // stayed brand orange. The helper prunes detached elements on every call, so
  // handing it both cannot grow a list across rebuilds.
  installNodeAccent(node, root, band);

  const height = () => (nodeConfig(node).videoSize ? VIDEO_SIZE_WIDGET_H : WIDGET_H);
  // WIDGET_NAME, not a repeated literal: faceAlive and teardownFace both search
  // for it, so if the two ever drifted apart teardownFace would silently stop
  // removing the widget and the sweep would build a second face every tick.
  const wname = nodeConfig(node).widgetName;
  const w = node.addDOMWidget(wname, "artthreads_resize_ui", root, {
    // canvasOnly is set adaptively: true in legacy (keeps it out of the
    // Parameters tab), false in Nodes 2.0 (so the Vue body renders it).
    getValue: () => null,
    setValue: () => {},
    getMinHeight: height,
    getMaxHeight: height,
    margin: 4,
    serialize: false,
  });
  applyAdaptiveCanvasOnly(w);
  // BOTH serialize flags, because they are different things: the `serialize`
  // passed in the options above is widget.options.serialize, which only keeps
  // the widget out of the PROMPT. The top-level widget.serialize is what keeps
  // it out of the saved WORKFLOW. With only the first one set, every saved file
  // carried a stray widgets_values entry (measured: `widgets_values: [""]`).
  // Harmless here because this is the only widget, but a second widget added
  // later would turn that stray entry into the value-shifting bug in Vue
  // Compat #23.
  w.serialize = false;

  // Nodes 2.0 drag floor: pin the content height ONLY while a resize handle is
  // dragged, so the rows cannot be dragged out of the node frame. The Vue
  // renderer's own floor is a live DOM measurement, not getMinHeight. No-op in
  // legacy; uninstalled in onRemoved.
  node._atLsFloorOff = installResizeFloor(root, height);
  // Deliberately NO node.size write here: this runs on a rebuild too, and
  // resetting the size on a renderer flip would throw away a size the user set.
  node.setDirtyCanvas(true, true);
}

// ── one watchdog for every node of this type ────────────────────────────────
// It does two jobs a per-node timer could not: rebuild a face the renderer flip
// destroyed (the node INSTANCE can be replaced, so a captured `node` in a
// per-node callback would be stale), and re-park the band after Vue replaces
// the node element. Cheap in the steady state - two property checks per node -
// and it stops as soon as the last node of this type is gone.
let _watchdog = 0;
let _rendererOff = null;
let _emptySweeps = 0;

/**
 * Every node of this type ANYWHERE, subgraphs included.
 *
 * `app.graph._nodes` is the root level only. A node inside a subgraph would
 * therefore never get its band parked or its readout refreshed - and worse, a
 * workflow whose only such nodes live in subgraphs would look empty to sweep(),
 * which after three quiet passes stops the watchdog for the whole page.
 *
 * Deliberately NOT reusing buildNodeIndex(): that Map is keyed on the bare
 * node id, and subgraph ids share the root id space, so it silently drops
 * colliding nodes. A plain array cannot.
 */
function collectNodes() {
  const found = [];
  const seen = new Set();
  const visit = (graph) => {
    if (!graph || seen.has(graph)) return;
    seen.add(graph);
    for (const n of (graph._nodes || graph.nodes || [])) {
      if (!n) continue;
      if (CLASS_SET.has(n.comfyClass)) found.push(n);
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return found;
}

function sweep() {
  const nodes = collectNodes();
  if (!nodes.length) {
    // Do NOT stop on the first empty sweep. A renderer flip and a workflow
    // switch both pass through a moment with zero nodes, and stopping there
    // would leave the nodes that come back a second later with no watchdog to
    // rebuild their faces. Three quiet passes (~1s) means genuinely gone.
    if (++_emptySweeps < 3) return;
    if (_watchdog) { clearInterval(_watchdog); _watchdog = 0; }
    _rendererOff?.();
    _rendererOff = null;
    return;
  }
  _emptySweeps = 0;
  for (const n of nodes) {
    // Per-node try/catch: without it one node in a bad state throws out of the
    // interval callback and every OTHER node of this type silently stops being
    // serviced - no re-parking, no readout refresh - forever.
    try {
      const rebuilt = ensureFace(n);
      const cfg = nodeConfig(n);

      if (!cfg.videoSize) {
        const linkId = n.inputs?.[0]?.link ?? null;
        if (n._atLsLinkSeen !== undefined && n._atLsLinkSeen !== linkId) {
          n._atLsLastIn = null;
        }
        n._atLsLinkSeen = linkId;
        const key = inputSizeKey(n);
        if (rebuilt || key !== n._atLsSizeKey) {
          n._atLsSizeKey = key;
          n._atLsRefresh?.();
        }
      } else if (rebuilt) {
        n._atLsRefresh?.();
      }
      if (isVueNodes() && !cfg.videoSize) parkBand(n);
    } catch (e) {
      console.error("[ArtThreads] Longest Side sweep failed for one node", e);
    }
  }
}

function startWatchdog() {
  // Reset the grace counter, or a watchdog that stopped once (leaving it at 3)
  // would stop again on the very first empty tick after restarting, throwing
  // away the three-pass window that exists to survive a renderer flip.
  _emptySweeps = 0;
  if (!_watchdog) _watchdog = setInterval(sweep, 350);
  if (!_rendererOff) {
    _rendererOff = onRendererChange(() => {
      // The flip and the re-render are not simultaneous, so sweep now AND let
      // the interval catch whatever settles a few hundred ms later.
      sweep();
      // collectNodes, not app.graph._nodes: a node inside a subgraph otherwise
      // never gets applyBandPlacement on a flip, so coming back to Classic it
      // keeps the `parked` styling for a slot block Classic does not build, and
      // its band simply disappears.
      for (const n of collectNodes()) { applyBandPlacement(n); n._atLsRefresh?.(); }
    });
  }
}

function patchNodeType(nodeType, nodeData) {
  if (!CLASS_SET.has(nodeData.name)) return;
  if (nodeType.prototype._atLsPatched) return;
  nodeType.prototype._atLsPatched = true;

  const isLongestSide = nodeData.name === "ArtThreadsLongestSide";

  const _origConfigure = nodeType.prototype.onConfigure;
  nodeType.prototype.onConfigure = function () {
    const r = _origConfigure?.apply(this, arguments);
    applyBandPlacement(this);
    queueMicrotask(() => { applyBandPlacement(this); this._atLsRefresh?.(); });
    startWatchdog();
    return r;
  };

  if (isLongestSide) {
    const _origExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      const r = _origExecuted?.apply(this, arguments);
      try {
        const info = message?.artthreads_longest_side?.[0];
        if (info?.in_w > 0 && info?.in_h > 0) {
          this._atLsLastIn = { w: info.in_w, h: info.in_h };
          this._atLsRefresh?.();
        }
      } catch {}
      return r;
    };
  }

  const _origOnResize = nodeType.prototype.onResize;
  nodeType.prototype.onResize = function (size) {
    if (!isVueNodes() && !isGraphLoading() && faceAlive(this)) {
      if (size[0] < MIN_W) size[0] = MIN_W;
      if (this.size[0] < MIN_W) this.size[0] = MIN_W;
      const natural = this.computeSize()[1];
      size[1] = natural;
      this.size[1] = natural;
    }
    if (_origOnResize) return _origOnResize.apply(this, arguments);
  };

  const _origDraw = nodeType.prototype.onDrawForeground;
  nodeType.prototype.onDrawForeground = function (ctx) {
    if (_origDraw) _origDraw.call(this, ctx);
    if (isVueNodes() || isGraphLoading()) return;
    if (this.flags?.collapsed) return;
    if (this.size[0] < MIN_W) this.size[0] = MIN_W;
  };

  const _origOnRemoved = nodeType.prototype.onRemoved;
  nodeType.prototype.onRemoved = function () {
    closeLongestSidePanelFor(this);
    teardownFace(this);
    const r = _origOnRemoved?.apply(this, arguments);
    setTimeout(sweep, 0);
    return r;
  };
}

app.registerExtension({
  name: "ArtThreads.LongestSide",

  beforeRegisterNodeDef(nodeType, nodeData) {
    patchNodeType(nodeType, nodeData);
  },

  nodeCreated(node) {
    if (!CLASS_SET.has(node.comfyClass)) return;
    buildFaceOnNode(node);
    // Fresh-drop size, set ONLY here and never on a rebuild. configure() runs
    // AFTER nodeCreated (Vue Compat #8), so a saved or duplicated node keeps its
    // own size; and this must not be deferred into a microtask, which would run
    // after configure and clobber it (UI convention #9).
    node.size[0] = DEFAULT_W;
    node.size[1] = node.computeSize()[1];
    node.setDirtyCanvas(true, true);
    startWatchdog();
  },
});

for (const cls of CLASS_NAMES) {
  registerNodeSettings(cls, {
    title: cls === "ArtThreadsVideoSize" ? "Video Size" : "Longest Side",
    ownMenuItem: false,
    open: (node) => openPanel(node),
    closeFor: (node) => closeLongestSidePanelFor(node),
  });
}
