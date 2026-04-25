"use client";

import { useState } from "react";
import type { SceneTreeNode } from "@/lib/three/variant-engine";

interface SceneTreeProps {
  nodes: SceneTreeNode[];
  selectedNames: Set<string>;
  assignedMeshes: Set<string>;
  deletedMeshes?: Set<string>;
  onSelect: (name: string) => void;
  onToggle: (name: string) => void;
  onToggleHidden?: (name: string) => void;
  depth?: number;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TreeRow({
  node, selectedNames, assignedMeshes, deletedMeshes, onSelect, onToggle, onToggleHidden, depth,
}: {
  node: SceneTreeNode;
  selectedNames: Set<string>;
  assignedMeshes: Set<string>;
  deletedMeshes?: Set<string>;
  onSelect: (name: string) => void;
  onToggle: (name: string) => void;
  onToggleHidden?: (name: string) => void;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isSelected  = selectedNames.has(node.name);
  const isAssigned  = assignedMeshes.has(node.name);
  const isHidden    = !!deletedMeshes?.has(node.name);
  const isMesh      = node.type === "Mesh";
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center group rounded-lg transition-colors ${
          isSelected
            ? "bg-blue-600/20"
            : isMesh
            ? "hover:bg-white/5"
            : ""
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {/* Collapse toggle for groups */}
        <button
          className="w-5 h-6 flex-shrink-0 flex items-center justify-center text-[9px] text-white/20"
          onClick={() => hasChildren && setCollapsed(v => !v)}
        >
          {hasChildren ? (collapsed ? "▸" : "▾") : ""}
        </button>

        {/* Checkbox (mesh only) */}
        {isMesh ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(node.name)}
            onClick={e => e.stopPropagation()}
            className="flex-shrink-0 w-3 h-3 rounded accent-blue-500 cursor-pointer mr-1.5"
          />
        ) : (
          <span className="w-3 flex-shrink-0 mr-1.5 text-[9px] text-white/20">◈</span>
        )}

        {/* Row label — click to single-select or ctrl+click to multi-toggle */}
        <button
          onClick={e => {
            if (!isMesh) { setCollapsed(v => !v); return; }
            if (e.ctrlKey || e.metaKey) onToggle(node.name);
            else onSelect(node.name);
          }}
          className={`flex-1 min-w-0 flex items-center gap-1.5 py-1 text-left ${
            isMesh ? "cursor-pointer" : "cursor-default"
          }`}
        >
          {isMesh && <span className="text-[9px] flex-shrink-0">▣</span>}
          <span className={`truncate font-mono text-[11px] ${
            isHidden ? "text-white/20 line-through" : isSelected ? "text-blue-300" : isMesh ? "text-white/70" : "text-white/30"
          }`}>
            {node.name}
          </span>

          {/* Assignment indicator */}
          {isAssigned && !isHidden && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-400/70" title="Assigned to an option" />
          )}
        </button>

        {/* Eye toggle (mesh only) */}
        {isMesh && onToggleHidden && (
          <button
            onClick={e => { e.stopPropagation(); onToggleHidden(node.name); }}
            title={isHidden ? "Show mesh" : "Hide mesh"}
            className={`flex-shrink-0 mr-1 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 ${
              isHidden ? "text-white/40 opacity-100" : "text-white/20 hover:text-white/70"
            }`}>
            <EyeIcon hidden={isHidden} />
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div>
          {node.children.map((child, i) => (
            <TreeRow
              key={`${child.name}-${i}`}
              node={child}
              selectedNames={selectedNames}
              assignedMeshes={assignedMeshes}
              deletedMeshes={deletedMeshes}
              onSelect={onSelect}
              onToggle={onToggle}
              onToggleHidden={onToggleHidden}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SceneTree({
  nodes, selectedNames, assignedMeshes, deletedMeshes, onSelect, onToggle, onToggleHidden, depth = 0,
}: SceneTreeProps) {
  if (nodes.length === 0) {
    return <div className="text-center py-8 text-white/25 text-xs">No scene graph loaded</div>;
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node, i) => (
        <TreeRow
          key={`${node.name}-${i}`}
          node={node}
          selectedNames={selectedNames}
          assignedMeshes={assignedMeshes}
          deletedMeshes={deletedMeshes}
          onSelect={onSelect}
          onToggle={onToggle}
          onToggleHidden={onToggleHidden}
          depth={depth}
        />
      ))}
    </div>
  );
}
