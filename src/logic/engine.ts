import { Option, ProjectGeometryRule } from "@/types/database";
import { PhaseId } from "@/constants/phases";

const ROOF_NODE = "Global_Roof_Group";

export interface EngineResult {
  /** Nodes the Sketchfab API should call show() on. */
  visibleNodes: string[];
  /** Full master hide list — useful for debugging or rule inspection. */
  masterHideList: string[];
}

/**
 * The ProPlan Studio visibility engine.
 *
 * Given the user's current selections and the project's geometry rules,
 * returns the exact set of nodes that should be visible in the viewer.
 *
 * Processing order:
 *  1. Collect every node from selectedOptions into a candidate visible set.
 *  2. Build the Master Hide List:
 *       a. "Always-hide" rules  — rules with an empty parent_option_name that
 *          fire unconditionally (e.g. legacy elevation nodes from Bubble).
 *       b. Option-triggered rules — rules whose parent_option_name matches a
 *          currently selected option's friendly_name.
 *  3. Roof Logic — if the phase is not 'exterior', force Global_Roof_Group
 *     onto the Master Hide List regardless of any selection.
 *  4. Subtract the Master Hide List from the candidate set to get visibleNodes.
 */
export function resolveVisibleNodes(
  selectedOptions: Option[],
  geometryRules: ProjectGeometryRule[],
  phase: PhaseId
): EngineResult {
  // ── Step 1: candidate nodes ────────────────────────────────────────────────
  // Every node that belongs to an active option is a candidate to be shown.
  const candidateNodes = new Set<string>(
    selectedOptions.flatMap((opt) => opt.node_list)
  );

  // ── Step 2: build the Master Hide List ────────────────────────────────────
  // Index rules by parent_option_name for O(1) lookup per selected option.
  const rulesByOption = new Map<string, ProjectGeometryRule[]>();
  const alwaysHideRules: ProjectGeometryRule[] = [];

  for (const rule of geometryRules) {
    if (rule.action !== "hide") continue; // only hide rules feed the master list

    if (!rule.parent_option_name) {
      // Empty parent = unconditional hide (fires regardless of selection)
      alwaysHideRules.push(rule);
    } else {
      const existing = rulesByOption.get(rule.parent_option_name);
      if (existing) {
        existing.push(rule);
      } else {
        rulesByOption.set(rule.parent_option_name, [rule]);
      }
    }
  }

  const masterHideList = new Set<string>();

  // 2a — always-hide rules
  for (const rule of alwaysHideRules) {
    masterHideList.add(rule.node_id);
  }

  // 2b — option-triggered rules
  for (const opt of selectedOptions) {
    const triggered = rulesByOption.get(opt.friendly_name) ?? [];
    for (const rule of triggered) {
      masterHideList.add(rule.node_id);
    }
  }

  // ── Step 3: Roof Logic ─────────────────────────────────────────────────────
  // The roof is only shown in Exterior phase. Blueprint and Interior look
  // inside the model so the roof must be removed unconditionally.
  if (phase !== "exterior") {
    masterHideList.add(ROOF_NODE);
  }

  // ── Step 4: subtract hide list from candidates ────────────────────────────
  const visibleNodes = [...candidateNodes].filter(
    (node) => !masterHideList.has(node)
  );

  return {
    visibleNodes,
    masterHideList: [...masterHideList],
  };
}
