import { app } from "/scripts/app.js";

const injectors = new Map();
const postProcessors = [];

/** @typedef {(node: object, entry: object) => void} PromptInjector */

/** Register hidden-state injection for one node class at queue time. */
export function registerPromptInjector(classType, fn) {
  if (!classType || typeof fn !== "function") return;
  injectors.set(classType, fn);
  installGraphPromptHook();
}

/** Register a post-processor on the workflow object graphToPrompt returns. */
export function onGraphToPrompt(fn) {
  if (typeof fn === "function") postProcessors.push(fn);
}

function activeGraph() {
  return app.graph || app.rootGraph;
}

export function buildNodeIndex(graph = activeGraph()) {
  const index = new Map();
  const visit = (g) => {
    if (!g) return;
    const nodes = g._nodes || g.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      index.set(String(n.id), n);
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== g) visit(inner);
    }
  };
  visit(graph);
  return index;
}

/** Serialized workflow.nodes fallback when the live graph node is missing. */
export function buildWorkflowNodeIndex(workflow) {
  const index = new Map();
  const nodes = workflow?.nodes;
  if (!Array.isArray(nodes)) return index;
  for (const n of nodes) {
    if (n?.id != null) index.set(String(n.id), n);
  }
  return index;
}

function workflowNodeAdapter(wfNode, classType) {
  if (!wfNode) return null;
  return {
    id: wfNode.id,
    type: wfNode.type,
    comfyClass: classType || wfNode.type,
    properties: wfNode.properties,
    inputs: wfNode.inputs,
  };
}

export function resolveNodeForPrompt(promptId, graphIndex, workflowIndex, classType) {
  const live = findNode(graphIndex, promptId);
  if (live) return live;
  const wfNode = findNode(workflowIndex, promptId);
  return workflowNodeAdapter(wfNode, classType);
}

export function findNode(index, promptId) {
  const sId = String(promptId);
  if (index.has(sId)) return index.get(sId);
  const tail = sId.includes(":") ? sId.slice(sId.lastIndexOf(":") + 1) : null;
  if (tail && index.has(tail)) return index.get(tail);
  return null;
}

export function collectNodesByClass(classType) {
  const found = [];
  const seen = new Set();
  const visit = (graph) => {
    if (!graph || seen.has(graph)) return;
    seen.add(graph);
    for (const n of graph._nodes || graph.nodes || []) {
      if (!n) continue;
      if (n.comfyClass === classType || n.type === classType) found.push(n);
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return found;
}

export function installGraphPromptHook() {
  if (app._atGraphPromptWrapped) return;
  app._atGraphPromptWrapped = true;

  const orig = app.graphToPrompt.bind(app);
  app.graphToPrompt = async function (...args) {
    const result = await orig(...args);
    try {
      const out = result?.output;
      if (out) {
        let graphIndex = null;
        let workflowIndex = null;
        for (const id in out) {
          const entry = out[id];
          const fn = injectors.get(entry?.class_type);
          if (!fn) continue;
          if (!graphIndex) graphIndex = buildNodeIndex();
          if (!workflowIndex) workflowIndex = buildWorkflowNodeIndex(result?.workflow);
          const node = resolveNodeForPrompt(id, graphIndex, workflowIndex, entry?.class_type);
          if (node) fn(node, entry);
        }
      }
      for (const pp of postProcessors) {
        try { pp(result); } catch (e) { console.warn("[ArtThreads] graphToPrompt post-processor failed", e); }
      }
    } catch (e) {
      console.error("[ArtThreads] graphToPrompt hook failed; prompt sent unchanged", e);
    }
    return result;
  };
}
