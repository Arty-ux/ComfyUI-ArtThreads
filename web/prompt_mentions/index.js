// Prompt Mentions ArtThreads — wiring.

import { app } from "/scripts/app.js";
import {
  applyAdaptiveCanvasOnly,
  isVueNodes,
  installCanvasZoomPassthrough,
  installResizeFloor,
} from "../shared/index.mjs";
import { isGraphLoading } from "../shared/graph_loading.mjs";
import { installNodeAccent, registerNodeSettings, repaintAccent } from "../shared/node_settings.mjs";
import {
  CLASS,
  MIN_W,
  MIN_H,
  DEFAULT_W,
  DEFAULT_H,
  WIDGET_MIN_H,
} from "./core.mjs";
import { buildFace, renderFace, destroyFace, injectCSS, closeAC, refreshAssets } from "./ui.mjs";

registerNodeSettings(CLASS, {
  title: "Prompt Mentions",
  ownMenuItem: false,
  onChange: (node) => {
    renderFace(node);
    repaintAccent(node);
  },
});

function refreshAllPromptMentions() {
  const nodes = (app.graph?._nodes || app.graph?.nodes || []).filter(
    (n) => n.comfyClass === CLASS || n.type === CLASS,
  );
  for (const n of nodes) {
    try { refreshAssets(n); } catch (_e) { /* node tearing down */ }
  }
}

let _assetWatch = 0;
function watchAssets() {
  if (_assetWatch) return;
  _assetWatch = setInterval(() => {
    const nodes = (app.graph?._nodes || app.graph?.nodes || []).filter(
      (n) => n.comfyClass === CLASS || n.type === CLASS,
    );
    if (!nodes.length) {
      clearInterval(_assetWatch);
      _assetWatch = 0;
      return;
    }
    refreshAllPromptMentions();
  }, 800);
}

let _graphHooked = false;
function installGraphHooks() {
  if (_graphHooked) return;
  _graphHooked = true;
  const g = app.graph;
  if (!g) return;
  const prevLink = g.onNodeConnectionChange;
  g.onNodeConnectionChange = function () {
    const r = prevLink?.apply(this, arguments);
    queueMicrotask(refreshAllPromptMentions);
    return r;
  };
  const prevChange = g.onNodeAdded;
  g.onNodeAdded = function () {
    const r = prevChange?.apply(this, arguments);
    queueMicrotask(refreshAllPromptMentions);
    return r;
  };
  const prevRemoved = g.onNodeRemoved;
  g.onNodeRemoved = function () {
    const r = prevRemoved?.apply(this, arguments);
    queueMicrotask(refreshAllPromptMentions);
    return r;
  };
}

app.registerExtension({
  name: "ArtThreads.PromptMentions",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== CLASS) return;
    if (nodeType.prototype._atPmPatched) return;
    nodeType.prototype._atPmPatched = true;

    injectCSS();

    const _created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      _created?.apply(this, arguments);
      const root = buildFace(this);
      const w = this.addDOMWidget("prompt_mentions_ui", "artthreads_prompt_mentions", root, {
        serialize: false,
        getMinHeight: () => WIDGET_MIN_H,
      });
      applyAdaptiveCanvasOnly(w);
      w.serialize = false;
      installCanvasZoomPassthrough(root);
      installNodeAccent(this, root);
      this._atPmFloorOff = installResizeFloor(root, () => WIDGET_MIN_H);

      if (!Array.isArray(this.size)) this.size = [DEFAULT_W, DEFAULT_H];
      this.size[0] = Math.max(this.size[0] || DEFAULT_W, DEFAULT_W);
      this.size[1] = Math.max(this.size[1] || DEFAULT_H, DEFAULT_H);

      installGraphHooks();
      watchAssets();
      queueMicrotask(() => renderFace(this));
    };

    const _configure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = _configure?.apply(this, arguments);
      renderFace(this);
      queueMicrotask(() => renderFace(this));
      return r;
    };

    const _resize = nodeType.prototype.onResize;
    nodeType.prototype.onResize = function (size) {
      if (!isVueNodes() && !isGraphLoading()) {
        if (size) {
          size[0] = Math.max(size[0] || MIN_W, MIN_W);
          size[1] = Math.max(size[1] || MIN_H, MIN_H);
        }
        if (Array.isArray(this.size)) {
          this.size[0] = Math.max(this.size[0] || MIN_W, MIN_W);
          this.size[1] = Math.max(this.size[1] || MIN_H, MIN_H);
        }
      }
      return _resize?.apply(this, arguments);
    };

    const _removed = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      closeAC();
      try { this._atPmFloorOff?.(); } catch (_e) { /* gone */ }
      destroyFace(this);
      return _removed?.apply(this, arguments);
    };
  },

  loadedGraphNode(node) {
    if (node?.comfyClass !== CLASS && node?.type !== CLASS) return;
    queueMicrotask(() => renderFace(node));
  },

  afterConfigureGraph() {
    installGraphHooks();
    watchAssets();
    queueMicrotask(refreshAllPromptMentions);
  },
});
