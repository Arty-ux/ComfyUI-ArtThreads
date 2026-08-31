// Multi Reference ArtThreads — wiring.

import { app } from "/scripts/app.js";
import {
  applyAdaptiveCanvasOnly,
  isVueNodes,
  installCanvasZoomPassthrough,
  installResizeFloor,
} from "../shared/index.mjs";
import { isGraphLoading } from "../shared/graph_loading.mjs";
import { registerPromptInjector } from "../shared/graph_prompt.mjs";
import { installNodeAccent, registerNodeSettings, repaintAccent } from "../shared/node_settings.mjs";
import {
  CLASS,
  HIDDEN_INPUT,
  MIN_W,
  MIN_H,
  DEFAULT_W,
  DEFAULT_H,
  WIDGET_MIN_H,
  injectedState,
} from "./core.mjs";
import { buildFace, renderFace, destroyFace, injectCSS } from "./ui.mjs";

registerPromptInjector(CLASS, (node, entry) => {
  entry.inputs = entry.inputs || {};
  entry.inputs[HIDDEN_INPUT] = JSON.stringify(injectedState(node));
});

registerNodeSettings(CLASS, {
  title: "Multi Reference",
  ownMenuItem: false,
  onChange: (node) => {
    renderFace(node);
    repaintAccent(node);
  },
});

app.registerExtension({
  name: "ArtThreads.MultiReference",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== CLASS) return;
    if (nodeType.prototype._atMrPatched) return;
    nodeType.prototype._atMrPatched = true;

    injectCSS();

    const _created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      _created?.apply(this, arguments);
      const root = buildFace(this);
      const w = this.addDOMWidget(HIDDEN_INPUT + "_ui", "artthreads_multi_reference", root, {
        serialize: false,
        getMinHeight: () => WIDGET_MIN_H,
      });
      applyAdaptiveCanvasOnly(w);
      w.serialize = false;
      installCanvasZoomPassthrough(root);
      installNodeAccent(this, root);
      this._atMrFloorOff = installResizeFloor(root, () => WIDGET_MIN_H);

      if (!Array.isArray(this.size)) this.size = [DEFAULT_W, DEFAULT_H];
      this.size[0] = Math.max(this.size[0] || DEFAULT_W, DEFAULT_W);
      this.size[1] = Math.max(this.size[1] || DEFAULT_H, DEFAULT_H);

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
        if (size[0] < MIN_W) size[0] = MIN_W;
        if (size[1] < MIN_H) size[1] = MIN_H;
      }
      return _resize?.apply(this, arguments);
    };

    const _draw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      if (!isVueNodes() && !isGraphLoading()) {
        if (this.size[0] < MIN_W) this.size[0] = MIN_W;
        if (this.size[1] < MIN_H) this.size[1] = MIN_H;
      }
      return _draw?.apply(this, arguments);
    };

    const _removed = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      this._atMrFloorOff?.();
      this._atMrFloorOff = null;
      destroyFace(this);
      return _removed?.apply(this, arguments);
    };
  },
});
