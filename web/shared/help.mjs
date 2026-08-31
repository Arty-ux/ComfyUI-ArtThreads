// ArtThreads node help registry (minimal — full help browser optional).

const _nodeHelp = new Map();

export function registerNodeHelp(comfyClass, helpDef) {
  if (comfyClass && helpDef) _nodeHelp.set(comfyClass, helpDef);
}

export function getNodeHelp(comfyClass) {
  return comfyClass ? _nodeHelp.get(comfyClass) || null : null;
}

export function allNodeHelp() {
  return [..._nodeHelp.entries()];
}

export function injectHelpCSS() {}

export function createHelpButton() {
  const b = document.createElement("button");
  b.type = "button";
  b.style.display = "none";
  return b;
}

export function openHelpPopup() {}

export function closeHelpPopup() {}
