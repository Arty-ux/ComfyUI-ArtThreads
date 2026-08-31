const listeners = new Set();
let timer = null;
let last = null;

const INTERVAL_MS = 300;

function currentMode() {
  return !!window.LiteGraph?.vueNodesMode;
}

function tick() {
  const now = currentMode();
  if (now === last) return;
  last = now;
  for (const cb of [...listeners]) {
    try {
      cb(now);
    } catch (err) {
      console.warn("[ArtThreads] renderer-change handler failed", err);
    }
  }
}

export function onRendererChange(cb) {
  if (typeof cb !== "function") return () => {};
  listeners.add(cb);
  if (timer == null) {
    last = currentMode();
    timer = setInterval(tick, INTERVAL_MS);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer != null) {
      clearInterval(timer);
      timer = null;
      last = null;
    }
  };
}
