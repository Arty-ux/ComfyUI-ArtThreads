import { app } from "/scripts/app.js";
import {
  getNodeSettings,
  openNodeSettings,
  closeNodeSettingsFor,
  BRAND,
} from "../shared/index.mjs";

const SET_CMD = "ArtThreads.ShowSettings";
const SET_ICON = "at-settings-toolbar-icon";
const CSS_ID = "at-settings-toolbar-css";

function injectIconCSS() {
  if (document.getElementById(CSS_ID)) return;
  const el = document.createElement("style");
  el.id = CSS_ID;
  el.textContent = `
    .${SET_ICON} {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; border-radius: 50%;
      background: ${BRAND}; color: #fff; font-size: 10px; font-weight: 700;
      line-height: 1;
    }
  `;
  document.head.appendChild(el);
}

function selectedNodes() {
  const c = app.canvas;
  if (!c) return [];
  const nodes = [];
  if (c.selected_nodes) nodes.push(...Object.values(c.selected_nodes));
  if (c.selectedItems) {
    for (const it of c.selectedItems) {
      if (it?.comfyClass) nodes.push(it);
    }
  }
  return nodes;
}

function firstWith(resolve) {
  for (const n of selectedNodes()) {
    const hit = resolve(n);
    if (hit) return { node: n, hit };
  }
  return null;
}

app.registerExtension({
  name: "ArtThreads.SettingsToolbar",

  commands: [
    {
      id: SET_CMD,
      label: "Settings",
      icon: SET_ICON,
      function: () => {
        const found = firstWith((n) => getNodeSettings(n.comfyClass));
        if (found) openNodeSettings(found.node);
      },
    },
  ],

  getSelectionToolboxCommands(item) {
    const cls = item?.comfyClass;
    if (!cls || !getNodeSettings(cls)) return [];
    return [SET_CMD];
  },

  getNodeMenuItems(node) {
    const def = getNodeSettings(node?.comfyClass);
    if (!def || def.ownMenuItem) return [];
    const label = def.menuLabel || `${def.title || "Node"} settings`;
    return [null, { content: `⚙ ${label}`, callback: () => openNodeSettings(node) }];
  },

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (!nodeData?.name || nodeType.prototype._atSettingsRemovedPatched) return;
    nodeType.prototype._atSettingsRemovedPatched = true;
    const origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      try {
        const def = getNodeSettings(this.comfyClass);
        if (def) (def.closeFor ? def.closeFor(this) : closeNodeSettingsFor(this));
      } catch {}
      return origRemoved?.apply(this, arguments);
    };
  },

  setup() {
    injectIconCSS();
  },
});
