import { app } from "/scripts/app.js";
import { isGraphLoading } from "./graph_loading.mjs";

let _timer = null;
let _netInstalled = false;

function activeChangeTracker() {
  try {
    return (
      app?.extensionManager?.workflow?.activeWorkflow?.changeTracker ||
      app?.workflowManager?.activeWorkflow?.changeTracker ||
      null
    );
  } catch {
    return null;
  }
}

function capture() {
  const ct = activeChangeTracker();
  if (!ct) return;
  if (typeof ct.captureCanvasState === "function") ct.captureCanvasState();
  else if (typeof ct.checkState === "function") ct.checkState();
}

export function installArtThreadsChangeNet() {
  if (_netInstalled || typeof document === "undefined") return;
  _netInstalled = true;
  const onUserAction = (e) => {
    const t = e.target;
    if (!t?.closest?.('[class*="at-"]')) return;
    notifyGraphChanged();
  };
  document.addEventListener("click", onUserAction, true);
  document.addEventListener("change", onUserAction, true);
}

export function notifyGraphChanged() {
  if (isGraphLoading()) return;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    _timer = null;
    if (isGraphLoading()) return;
    try {
      capture();
    } catch (e) {
      console.warn("[ArtThreads] could not notify ComfyUI of a graph change", e);
    }
  }, 120);
}
