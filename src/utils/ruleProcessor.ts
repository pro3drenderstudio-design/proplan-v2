import { Variable, GeometryRule } from "@/types/database";

export interface RuleProcessorResult {
  /** Nodes that must be hidden regardless of user selection. */
  forcedHiddenNodes: string[];
  /** Nodes that must be shown regardless of user selection. */
  forcedShownNodes: string[];
  /**
   * Variable IDs that were auto-selected because a 'require' rule fired.
   * Merge these into selectedVariables before rendering the UI.
   */
  requiredVariableIds: string[];
  /**
   * Variable IDs that are blocked because an 'exclude' rule fired.
   * Remove these from selectedVariables before rendering the UI.
   */
  excludedVariableIds: string[];
}

/**
 * Evaluates all geometry_rules against the current selection and returns
 * the set of forced overrides that must be applied before the viewer renders.
 *
 * Processing order:
 *   1. Walk every selected variable and collect all matching rules.
 *   2. 'require' rules can chain — a newly required variable may itself trigger
 *      more rules. This is resolved iteratively with a visited set to prevent cycles.
 *   3. 'exclude' always wins over 'require' if both fire on the same variable.
 *   4. 'hide' always wins over 'show' if both fire on the same node.
 *
 * @param selectedVariables  The variables currently chosen by the user.
 * @param allVariables       The full variable list (needed to look up nodes for
 *                           require-chained variables not in selectedVariables).
 * @param geometryRules      The geometry_rules rows fetched from Supabase.
 */
export function processRules(
  selectedVariables: Variable[],
  allVariables: Variable[],
  geometryRules: GeometryRule[]
): RuleProcessorResult {
  // Fast lookup maps built once
  const variableById = new Map<string, Variable>(allVariables.map((v) => [v.id, v]));
  const rulesByTrigger = buildRuleIndex(geometryRules);

  const forcedHiddenNodes = new Set<string>();
  const forcedShownNodes  = new Set<string>();
  const requiredIds       = new Set<string>();
  const excludedIds       = new Set<string>();

  // ── Iterative BFS over selected + require-chained variables ──────────────
  // Start with the user's current selection; expand as 'require' rules fire.
  const queue: string[] = selectedVariables.map((v) => v.id);
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const triggerId = queue.shift()!;
    const rules = rulesByTrigger.get(triggerId) ?? [];

    for (const rule of rules) {
      const target = variableById.get(rule.target_variable_id);
      if (!target) {
        console.warn(`ruleProcessor: target variable "${rule.target_variable_id}" not found`);
        continue;
      }

      switch (rule.action) {
        case "hide":
          target.node_names.forEach((n) => forcedHiddenNodes.add(n));
          break;

        case "show":
          target.node_names.forEach((n) => forcedShownNodes.add(n));
          break;

        case "require":
          requiredIds.add(target.id);
          // Chain: if this target hasn't been processed yet, add it to the queue
          // so its own rules are evaluated too.
          if (!visited.has(target.id)) {
            visited.add(target.id);
            queue.push(target.id);
          }
          break;

        case "exclude":
          excludedIds.add(target.id);
          break;
      }
    }
  }

  // ── Conflict resolution ───────────────────────────────────────────────────
  // 'exclude' beats 'require' — if the same variable appears in both sets,
  // the exclusion wins and it is removed from requiredIds.
  excludedIds.forEach((id) => requiredIds.delete(id));

  // 'hide' beats 'show' — if the same node appears in both sets,
  // the hide wins and it is removed from forcedShownNodes.
  forcedHiddenNodes.forEach((node) => forcedShownNodes.delete(node));

  return {
    forcedHiddenNodes: [...forcedHiddenNodes],
    forcedShownNodes:  [...forcedShownNodes],
    requiredVariableIds: [...requiredIds],
    excludedVariableIds: [...excludedIds],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Groups rules by their trigger_variable_id for O(1) lookup per variable. */
function buildRuleIndex(rules: GeometryRule[]): Map<string, GeometryRule[]> {
  const index = new Map<string, GeometryRule[]>();
  for (const rule of rules) {
    const existing = index.get(rule.trigger_variable_id);
    if (existing) {
      existing.push(rule);
    } else {
      index.set(rule.trigger_variable_id, [rule]);
    }
  }
  return index;
}
