// Load Audio ArtThreads — wiring.

import { app } from "/scripts/app.js";
import {
  applyAdaptiveCanvasOnly,
  isVueNodes,
  installZoomRepaint,
  installCanvasZoomPassthrough,
  installResizeFloor,
} from "../shared/index.mjs";
import { isGraphLoading } from "../shared/graph_loading.mjs";
import { registerPromptInjector, collectNodesByClass } from "../shared/graph_prompt.mjs";
import { installNodeAccent, registerNodeSettings, repaintAccent } from "../shared/node_settings.mjs";
import { CLASS, HIDDEN_INPUT, MIN_W, DEFAULT_W, injectedState, readState, writeState } from "./core.mjs";
import { buildFace, renderFace, destroyFace, injectCSS, stopPlay, repaintWave } from "./ui.mjs";
import { openLoadAudioPanel, closeLoadAudioPanelFor } from "./settings.mjs";

const WIDGET_MIN_H = 190;
const MIN_H = 234;
const DEFAULT_H = 250;

registerPromptInjector(CLASS, (node, entry) => {
  entry.inputs = entry.inputs || {};
  entry.inputs[HIDDEN_INPUT] = JSON.stringify(injectedState(node));
});

registerNodeSettings(CLASS, {
  title: "Load Audio",
  ownMenuItem: false,
  open: (node) => openPanel(node),
  closeFor: (node) => closeLoadAudioPanelFor(node),
  onChange: (node) => renderFace(node),
});

let _watch = 0;
const _lastSeen = new WeakMap();

function watchUpstream() {
  if (_watch) return;
  _watch = setInterval(() => {
    const nodes = collectNodesByClass(CLASS);
    if (!nodes.length) { clearInterval(_watch); _watch = 0; return; }
    for (const n of nodes) {
      const slot = n.inputs?.find((i) => i && i.name === "seconds");
      const key = `${slot?.link ?? "none"}|${upstreamLength(n)}`;
      if (_lastSeen.get(n) === key) continue;
      _lastSeen.set(n, key);
      renderFace(n);
    }
  }, 400);
}

function secondsWired(node) {
  const s = node?.inputs?.find((i) => i && i.name === "seconds");
  return !!(s && s.link != null);
}

function releaseWiredLength(node) {
  if (secondsWired(node)) return;
  const dur = node._atLaDur || 0;
  if (dur <= 0) return;
  const st = readState(node);
  if (st.whenUnwired !== "length") return;
  const fits = Math.max(0, dur - st.start);
  if (st.length <= fits + 0.005) return;
  writeState(node, { length: Math.round(fits * 100) / 100 });
  renderFace(node);
}

function upstreamLength(node) {
  const slot = node?.inputs?.find((i) => i && i.name === "seconds");
  if (!slot || slot.link == null || !node.graph) return null;
  const g = node.graph;
  let link = g.links?.[slot.link];
  if (!link && typeof g.links?.get === "function") link = g.links.get(slot.link);
  const src = link ? g.getNodeById?.(link.origin_id) : null;
  if (!src || src.mode === 2 || src.mode === 4) return null;
  const v = src._atLiveSeconds;
  return Number.isFinite(v) ? v : null;
}

function openPanel(node) {
  openLoadAudioPanel(node, (n) => {
    renderFace(n);
    repaintAccent(n);
    n.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
  });
}

app.registerExtension({
  name: "ArtThreads.LoadAudio",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== CLASS) return;
    if (nodeType.prototype._atLaPatched) return;
    nodeType.prototype._atLaPatched = true;

    injectCSS();

    const _created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      _created?.apply(this, arguments);
      const root = buildFace(this, openPanel);
      const w = this.addDOMWidget(HIDDEN_INPUT + "_ui", "artthreads_load_audio", root, {
        serialize: false,
        getMinHeight: () => WIDGET_MIN_H,
      });
      applyAdaptiveCanvasOnly(w);
      w.serialize = false;
      installCanvasZoomPassthrough(root);
      installNodeAccent(this, root);
      this._atLaFloorOff = installResizeFloor(root, () => WIDGET_MIN_H);
      this._atLaZoomOff = installZoomRepaint(this, null, () => repaintWave(this), "_atLaRaf");

      if (!Array.isArray(this.size)) this.size = [DEFAULT_W, DEFAULT_H];
      this.size[0] = DEFAULT_W;
      this.size[1] = DEFAULT_H;

      queueMicrotask(() => renderFace(this));
      watchUpstream();
    };

    const _origConfigureFn = nodeType.prototype.configure;
    nodeType.prototype.configure = function () {
      this._atLaConfiguring = true;
      try { return _origConfigureFn.apply(this, arguments); }
      finally { this._atLaConfiguring = false; }
    };

    const _origConnChange = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function (type, index, connected, link, ioSlot) {
      const r = _origConnChange?.apply(this, arguments);
      const INPUT = window.LiteGraph?.INPUT ?? 1;
      if (type === INPUT && !connected && ioSlot?.name === "seconds"
          && !this._atLaConfiguring && !isGraphLoading()) {
        queueMicrotask(() => releaseWiredLength(this));
      }
      return r;
    };

    const _configure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = _configure?.apply(this, arguments);
      renderFace(this);
      queueMicrotask(() => renderFace(this));
      watchUpstream();
      return r;
    };

    const _executed = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      const r = _executed?.apply(this, arguments);
      const info = message?.artthreads_load_audio?.[0];
      if (info) {
        this._atLaRun = info;
        renderFace(this);
      }
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
      closeLoadAudioPanelFor(this);
      stopPlay(this);
      this._atLaFloorOff?.();
      this._atLaFloorOff = null;
      this._atLaZoomOff?.();
      this._atLaZoomOff = null;
      destroyFace(this);
      return _removed?.apply(this, arguments);
    };
  },
});

export { openPanel };
