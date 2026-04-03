import { PhaseId } from "@/constants/phases";
import { ModelNodeGroups } from "@/types/database";

export type LevelId = 1 | 2 | 3;

const DEFAULT_NODES: Required<ModelNodeGroups> = {
  roof:   "Global_Roof_Group",
  level1: "Level_One_Group",
  level2: "Level_Two_Group",
  level3: "Level_Three_Group",
};

export interface SketchfabNode {
  instanceID: number;
  name?: string;
  [key: string]: unknown;
}

export type NodeMap = Record<string, SketchfabNode>;

export interface VisibilityApi {
  show: (instanceId: number) => void;
  hide: (instanceId: number) => void;
}

/**
 * Central visibility brain for ProPlan Studio.
 *
 * PASS ORDER IS CRITICAL:
 *   Pass 1 — Option-driven mesh visibility (managed nodes only)
 *   Pass 2 — Level cascade (show/hide floor groups)
 *   Pass 3 — Roof logic  ← MUST be last
 *
 * The roof pass must run after the level pass because level groups
 * may be parents of the roof in the scene hierarchy. If show(level1)
 * is called after hide(roof), the roof becomes visible again. Running
 * roof logic last guarantees the hide is the final call on that node.
 */
export function applyVisibility(
  api: VisibilityApi,
  nodeMap: NodeMap,
  phase: PhaseId,
  level: LevelId,
  nodeGroups: ModelNodeGroups = {},
  selectedOptions: string[] = [],
  allOptionNodes: string[] = [],
): void {
  if (!phase) return;

  const nodes = { ...DEFAULT_NODES, ...nodeGroups } as Required<ModelNodeGroups>;
  const selectedSet = new Set(selectedOptions);

  function show(name: string) {
    const node = nodeMap[name];
    if (node) api.show(node.instanceID);
  }

  function hide(name: string) {
    const node = nodeMap[name];
    if (node) api.hide(node.instanceID);
  }

  // Structural nodes are exclusively owned by Passes 2 & 3.
  // Exclude them from Pass 1 to prevent race conditions.
  const structuralNodes = new Set([nodes.roof, nodes.level1, nodes.level2, nodes.level3]);

  // ── Pass 1: option-driven visibility ──────────────────────────────────────
  // Skip if either list is empty — avoids blanking the model before data loads.
  if (selectedSet.size > 0 && allOptionNodes.length > 0) {
    for (const nodeName of allOptionNodes) {
      if (structuralNodes.has(nodeName)) continue;
      if (selectedSet.has(nodeName)) {
        show(nodeName);
      } else {
        hide(nodeName);
      }
    }
  }

  // ── Pass 2: Level logic ────────────────────────────────────────────────────
  // Exterior: all floors always visible (floor selector is hidden in that phase).
  // Blueprint / Interior: show only up to the selected level.
  show(nodes.level1);
  if (phase === "exterior" || phase === "interior" || level >= 2) { show(nodes.level2); } else { hide(nodes.level2); }
  if (phase === "exterior" || phase === "interior" || level >= 3) { show(nodes.level3); } else { hide(nodes.level3); }

  // ── Pass 3: Roof logic — MUST be the final pass ────────────────────────────
  // Blueprint: roof is hidden (top-down floor plan view).
  // Interior / Exterior: roof is always shown.
  if (phase === "blueprint") {
    hide(nodes.roof);
  } else {
    show(nodes.roof);
  }
}
