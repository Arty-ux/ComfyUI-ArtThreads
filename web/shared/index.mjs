// ArtThreads shared — barrel export.
// Keep ARTTHREADS_JS_VERSION in lockstep with pyproject.toml version.

export { ARTTHREADS_JS_VERSION } from "./node_settings.mjs";

export { artApiUrl, artGearMask, artAsset } from "./api_url.mjs";

export {
  isVueNodes,
  applyAdaptiveCanvasOnly,
  canvasBackingScale,
  installZoomRepaint,
} from "./nodes2.mjs";

export { onRendererChange } from "./renderer_switch.mjs";

export { isGraphLoading } from "./graph_loading.mjs";

export { notifyGraphChanged, installArtThreadsChangeNet } from "./graph_changed.mjs";

export { installCanvasZoomPassthrough } from "./canvas_zoom.mjs";

export { placeZoomedPopup, placeZoomedPopupAt, applyPopupZoom, popupZoom } from "./popup_zoom.mjs";

export { installResizeFloor, measureRootContent } from "./resize_floor.mjs";

export {
  registerPromptInjector,
  onGraphToPrompt,
  buildNodeIndex,
  findNode,
  collectNodesByClass,
  installGraphPromptHook,
} from "./graph_prompt.mjs";

export {
  BRAND,
  ACC,
  ACCENT_VAR,
  GLOBAL_ACCENT_SETTING,
  DEFAULT_ACCENT_PROP,
  registerNodeSettings,
  registerNodeAccent,
  getNodeSettings,
  openNodeSettings,
  closeNodeSettingsPanel,
  closeNodeSettingsFor,
  accentOf,
  setNodeAccent,
  applyAccent,
  installNodeAccent,
  repaintAccent,
  nodeSetting,
  setNodeSetting,
  classAccentSetting,
  createOptionRows,
  createAccentSection,
} from "./node_settings.mjs";
