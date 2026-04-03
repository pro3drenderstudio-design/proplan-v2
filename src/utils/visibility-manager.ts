import { PhaseId } from "@/constants/phases";

export type LevelId = 1 | 2 | 3;

// Canonical Sketchfab node names
const NODES = {
  roof: "Global_Roof_Group",
  level3: "Level_Three_Group",
  level2: "Level_Two_Group",
  level1: "Level_One_Group",
} as const;

interface SketchfabNode {
  instanceID: number;
  [key: string]: unknown;
}

export interface VisibilityApi {
  getNodeMap: (cb: (err: unknown, nodeMap: Record<string, SketchfabNode>) => void) => void;
  show: (instanceId: number) => void;
  hide: (instanceId: number) => void;
}

/**
 * Applies phase + level visibility rules to the Sketchfab model.
 * Assumes the API is initialised and ready to receive show/hide calls.
 */
export function updateVisibility(api: VisibilityApi, phase: PhaseId, level: LevelId): void {
  api.getNodeMap((err, nodeMap) => {
    if (err) {
      console.error("updateVisibility: getNodeMap failed", err);
      return;
    }

    // Helper — silently skips if the node name isn't in the map
    function show(name: string) {
      const entry = nodeMap[name];
      if (!entry) { console.warn(`updateVisibility: node "${name}" not found`); return; }
      api.show(entry.instanceID);
    }

    function hide(name: string) {
      const entry = nodeMap[name];
      if (!entry) { console.warn(`updateVisibility: node "${name}" not found`); return; }
      api.hide(entry.instanceID);
    }

    // ── Roof rule ──────────────────────────────────────────────────────────
    // Exterior: roof visible. Blueprint / Interior: always hidden.
    if (phase === "exterior") {
      show(NODES.roof);
    } else {
      hide(NODES.roof);
    }

    // ── Level rules ────────────────────────────────────────────────────────
    // Level 1 → only ground floor visible
    // Level 2 → ground + first floor visible
    // Level 3 → all floors visible
    show(NODES.level1); // level 1 is always visible

    if (level >= 2) {
      show(NODES.level2);
    } else {
      hide(NODES.level2);
    }

    if (level >= 3) {
      show(NODES.level3);
    } else {
      hide(NODES.level3);
    }
  });
}
