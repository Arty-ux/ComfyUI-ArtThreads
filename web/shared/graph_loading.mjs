import { app } from "/scripts/app.js";

let _loading = false;

if (app?.loadGraphData && !app._atGraphLoadWrapped) {
  app._atGraphLoadWrapped = true;
  const orig = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _loading = true;
    let r;
    try {
      r = orig(...args);
    } finally {
      Promise.resolve(r).finally(() => setTimeout(() => { _loading = false; }, 300));
    }
    return r;
  };
}

export function isGraphLoading() {
  return _loading;
}
