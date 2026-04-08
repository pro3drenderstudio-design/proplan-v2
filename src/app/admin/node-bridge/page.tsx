"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import AdminSketchfabViewer, { AdminSketchfabApi } from "@/components/admin/AdminSketchfabViewer";
import {
  getAllProjects,
  getCategoriesWithOptions,
  saveOptionMapping,
  savePhaseCamera,
  saveCategoryCamera,
  setDefaultOption,
} from "@/lib/admin-api";
import { Project, CategoryWithOptions, PhaseColumn } from "@/types/database";

interface NodeEntry {
  name: string;
  instanceID: number;
}

export default function NodeBridgePage() {
  // ── Project / model ─────────────────────────────────────────────────────────
  const [projects, setProjects]               = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [modelUid, setModelUid]               = useState("");
  const [pendingUid, setPendingUid]           = useState("");
  const [viewerKey, setViewerKey]             = useState(0);

  // ── Categories / options ─────────────────────────────────────────────────────
  const [categories, setCategories]           = useState<CategoryWithOptions[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedOptionId, setSelectedOptionId]     = useState("");

  // ── Nodes ────────────────────────────────────────────────────────────────────
  const [nodes, setNodes]                     = useState<NodeEntry[]>([]);
  const [nodeFilter, setNodeFilter]           = useState("");
  const [checkedNodes, setCheckedNodes]       = useState<Set<string>>(new Set());
  const [nodeConditions, setNodeConditions]   = useState<Record<string, string>>({});
  const [isFetching, setIsFetching]           = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // ── Camera capture ───────────────────────────────────────────────────────────
  const [capturePhase, setCapturePhase]       = useState<PhaseColumn>("exterior");

  // ── Feedback ─────────────────────────────────────────────────────────────────
  const [feedback, setFeedback]               = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Mobile panel ─────────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Viewer API ref ───────────────────────────────────────────────────────────
  const apiRef   = useRef<AdminSketchfabApi | null>(null);
  const [apiReady, setApiReady] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedProject  = projects.find(p => p.id === selectedProjectId);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedOption   = selectedCategory?.options.find(o => o.id === selectedOptionId);

  const filteredNodes = useMemo(
    () => nodes.filter(n => {
      if (showSelectedOnly && !checkedNodes.has(n.name)) return false;
      return n.name.toLowerCase().includes(nodeFilter.toLowerCase());
    }),
    [nodes, nodeFilter, showSelectedOnly, checkedNodes]
  );

  const isDefault = !!selectedOption &&
    selectedOption.friendly_name === selectedCategory?.default_option;

  const allOptionsFlat = useMemo(
    () => categories.flatMap(cat =>
      cat.options.map(opt => ({ id: opt.id, label: `${cat.name} : ${opt.friendly_name}` }))
    ),
    [categories]
  );

  // All node names that are mapped to at least one option — only these are ever hidden/shown.
  // Parent/structural nodes that no option owns are never touched so they stay visible
  // and don't block children from being shown.
  const allMappedNodeNames = useMemo(() => {
    const names = new Set<string>();
    for (const cat of categories) {
      for (const opt of cat.options) {
        for (const name of (opt.node_list ?? [])) names.add(name);
      }
    }
    return names;
  }, [categories]);

  // ── Load projects on mount ───────────────────────────────────────────────────
  useEffect(() => { getAllProjects().then(setProjects); }, []);

  // ── When project changes, sync UID + load categories ─────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const uid = selectedProject.sketchfab_uid;
    setPendingUid(uid);
    setModelUid(uid);
    setViewerKey(k => k + 1);
    getCategoriesWithOptions(selectedProject.id).then(setCategories);
    setSelectedCategoryId("");
    setSelectedOptionId("");
    setNodes([]);
    setCheckedNodes(new Set());
    setApiReady(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // ── Pre-check nodes + conditions when option changes ─────────────────────────
  useEffect(() => {
    setCheckedNodes(new Set(selectedOption?.node_list ?? []));
    setNodeConditions(selectedOption?.node_conditions ?? {});
  }, [selectedOptionId]);

  // Keep a ref so the visibility effect can read the current selectedOptionId
  // without having it as a dependency (avoids firing before checkedNodes updates).
  const selectedOptionIdRef = useRef(selectedOptionId);
  selectedOptionIdRef.current = selectedOptionId;

  // ── Sync viewer visibility with checkedNodes ──────────────────────────────────
  useEffect(() => {
    const api = apiRef.current;
    if (!apiReady || !api || nodes.length === 0) return;
    if (!selectedOptionIdRef.current) {
      // No option selected — restore all mapped nodes to visible
      for (const node of nodes) {
        if (allMappedNodeNames.has(node.name)) api.show(node.instanceID);
      }
    } else {
      // Only show/hide nodes that belong to at least one option mapping.
      // Structural / parent nodes that no option owns are never touched —
      // hiding a parent would block show() on its children.
      for (const node of nodes) {
        if (!allMappedNodeNames.has(node.name)) continue;
        if (checkedNodes.has(node.name)) api.show(node.instanceID);
        else api.hide(node.instanceID);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedNodes, nodes, apiReady, allMappedNodeNames]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function flash(msg: string, ok = true) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function reloadCategories(projectId: string) {
    if (!projectId) return;
    const updated = await getCategoriesWithOptions(projectId);
    setCategories(updated);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleFetchNodes() {
    if (!apiRef.current) { flash("Viewer not ready", false); return; }
    setIsFetching(true);
    apiRef.current.getNodeMap((err, rawMap) => {
      setIsFetching(false);
      if (err) { flash("Failed to fetch nodes", false); return; }
      // Deduplicate by name — multiple instanceIDs can share the same node name
      // (instanced meshes). For mapping purposes one name = one logical node.
      const seen = new Set<string>();
      const list: NodeEntry[] = [];
      for (const id in rawMap) {
        const node = rawMap[id];
        if (node.name && !seen.has(node.name)) {
          seen.add(node.name);
          list.push({ name: node.name, instanceID: node.instanceID });
        }
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setNodes(list);
      flash(`Fetched ${list.length} nodes`);
    });
  }

  function handleChangeModelUid() {
    if (!pendingUid || pendingUid === modelUid) return;
    setModelUid(pendingUid);
    setViewerKey(k => k + 1);
    setNodes([]);
    setCheckedNodes(new Set());
    apiRef.current = null;
    setApiReady(false);
  }

  async function handleSaveMapping() {
    if (!selectedOptionId) { flash("Select an option first", false); return; }
    // Strip conditions for unchecked nodes
    const activeConditions: Record<string, string> = {};
    for (const nodeName of checkedNodes) {
      if (nodeConditions[nodeName]) activeConditions[nodeName] = nodeConditions[nodeName];
    }
    const ok = await saveOptionMapping(selectedOptionId, [...checkedNodes], activeConditions);
    flash(ok ? "Mapping saved!" : "Save failed", ok);
    if (ok) reloadCategories(selectedProjectId);
  }

  async function handleSetAsDefault() {
    if (!selectedCategoryId || !selectedOption) { flash("Select an option first", false); return; }
    const ok = await setDefaultOption(selectedCategoryId, selectedOption.friendly_name);
    flash(ok ? "Set as default!" : "Failed", ok);
    if (ok) reloadCategories(selectedProjectId);
  }

  function handleSetCategoryCamera() {
    if (!apiRef.current) { flash("Viewer not ready", false); return; }
    if (!selectedCategoryId) { flash("Select a category first", false); return; }
    apiRef.current.getCameraLookAt((err, camera) => {
      if (err || !apiRef.current) { flash("Failed to read camera", false); return; }
      apiRef.current.getFov((err2, fov) => {
        if (err2) { flash("Failed to read FOV", false); return; }
        saveCategoryCamera(selectedCategoryId, { pos: camera.position, target: camera.target, fov })
          .then(ok => flash(ok ? "Category camera saved!" : "Save failed", ok));
      });
    });
  }

  function handleSetPhaseCamera() {
    if (!apiRef.current) { flash("Viewer not ready", false); return; }
    if (!selectedProjectId) { flash("Select a project first", false); return; }
    apiRef.current.getCameraLookAt((err, camera) => {
      if (err || !apiRef.current) { flash("Failed to read camera", false); return; }
      apiRef.current.getFov((err2, fov) => {
        if (err2) { flash("Failed to read FOV", false); return; }
        savePhaseCamera(selectedProjectId, capturePhase, { pos: camera.position, target: camera.target, fov })
          .then(ok => flash(ok ? `${capturePhase} camera saved!` : "Save failed", ok));
      });
    });
  }

  function toggleNode(name: string) {
    setCheckedNodes(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function toggleAllFiltered() {
    const allChecked = filteredNodes.every(n => checkedNodes.has(n.name));
    setCheckedNodes(prev => {
      const next = new Set(prev);
      if (allChecked) {
        filteredNodes.forEach(n => next.delete(n.name));
      } else {
        filteredNodes.forEach(n => next.add(n.name));
      }
      return next;
    });
  }

  function setCondition(nodeName: string, conditionOptionId: string) {
    setNodeConditions(prev => {
      const next = { ...prev };
      if (conditionOptionId) next[nodeName] = conditionOptionId;
      else delete next[nodeName];
      return next;
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#111] text-white font-sans">

      {/* Sub-header */}
      <div className="flex items-center px-5 py-2.5 border-b border-white/10 bg-[#1a1a1a] flex-shrink-0">
        <button
          onClick={() => setPanelOpen(v => !v)}
          className="md:hidden mr-3 w-7 h-7 flex items-center justify-center rounded bg-white/8 text-white/50 hover:text-white transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-xs text-white/40">
          Node Bridge{selectedProject ? ` › ${selectedProject.name}` : " › Select a project"}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile backdrop */}
        {panelOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setPanelOpen(false)} />
        )}

        {/* ── Left Panel ────────────────────────────────────────────────────── */}
        <div className={[
          "flex-shrink-0 bg-[#1a1a1a] border-r border-white/10 overflow-y-auto flex flex-col",
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300",
          "md:relative md:translate-x-0 md:z-auto md:inset-auto",
          panelOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}>

          {/* Section label helper */}
          <div className="flex flex-col gap-5 p-4">

            {/* Project selector */}
            <Section label="Project">
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full bg-[#252525] border border-white/15 rounded px-3 py-2 text-sm text-white"
              >
                <option value="">Select Project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Section>

            {/* Node Fetcher */}
            <Section label="Node Mapping">
              <p className="text-[10px] text-white/30 mb-1">Sketchfab Model UID</p>
              <input
                value={pendingUid}
                onChange={e => setPendingUid(e.target.value)}
                className="w-full bg-[#252525] border border-white/15 rounded px-3 py-1.5 text-xs font-mono text-white mb-2"
              />
              <button
                onClick={handleFetchNodes}
                disabled={!modelUid || isFetching}
                className="w-full py-2 rounded text-xs font-bold bg-[#1f1800] border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40 mb-2 flex items-center justify-center gap-1.5"
              >
                ⚡ {isFetching ? "FETCHING…" : "[ FETCH NODES ]"}
              </button>
              <button
                onClick={handleChangeModelUid}
                disabled={!pendingUid || pendingUid === modelUid}
                className="w-full py-2 rounded text-xs font-bold bg-[#001f1f] border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                🔄 [CHANGE MODEL UID]
              </button>
            </Section>

            {/* Option Variable */}
            <Section label="Select Option Variable">
              <select
                value={selectedCategoryId}
                onChange={e => { setSelectedCategoryId(e.target.value); setSelectedOptionId(""); }}
                className="w-full bg-[#252525] border border-white/15 rounded px-3 py-2 text-sm text-white mb-2"
              >
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={selectedOptionId}
                onChange={e => setSelectedOptionId(e.target.value)}
                disabled={!selectedCategoryId}
                className="w-full bg-[#252525] border border-white/15 rounded px-3 py-2 text-sm text-white mb-3 disabled:opacity-40"
              >
                <option value="">Select a variable to map…</option>
                {selectedCategory?.options.map(o => (
                  <option key={o.id} value={o.id}>{o.friendly_name}</option>
                ))}
              </select>
              <button
                onClick={handleSaveMapping}
                disabled={!selectedOptionId}
                className="w-full py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 mb-2"
              >
                💾 Save Mapping
              </button>
              <button
                onClick={handleSetAsDefault}
                disabled={!selectedOptionId || isDefault}
                className={[
                  "w-full py-2 rounded text-sm font-semibold mb-2",
                  isDefault
                    ? "bg-green-700 text-green-200 cursor-not-allowed"
                    : "bg-[#252525] border border-white/20 text-white hover:bg-white/10 disabled:opacity-40",
                ].join(" ")}
              >
                {isDefault ? "✓ Saved as Default" : "Save as Default"}
              </button>
              <button
                onClick={handleSetCategoryCamera}
                disabled={!selectedCategoryId}
                className="w-full py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
              >
                📷 Set Category Camera
              </button>
            </Section>

            {/* Camera Capture */}
            <Section label="Camera Capture">
              <select
                value={capturePhase}
                onChange={e => setCapturePhase(e.target.value as PhaseColumn)}
                className="w-full bg-[#252525] border border-white/15 rounded px-3 py-2 text-sm text-white mb-2"
              >
                <option value="exterior">Exterior</option>
                <option value="interior">Interior</option>
                <option value="blueprint">Blueprint</option>
              </select>
              <button
                onClick={handleSetPhaseCamera}
                disabled={!selectedProjectId}
                className="w-full py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
              >
                📷 Set Camera
              </button>
            </Section>

            {/* Visibility Hierarchy */}
            <Section
              label="Visibility Hierarchy"
              action={<button onClick={handleFetchNodes} className="text-white/30 hover:text-white text-xs leading-none">🔄</button>}
            >
              <div className="flex gap-2 mb-2">
                <input
                  value={nodeFilter}
                  onChange={e => setNodeFilter(e.target.value)}
                  placeholder="Filter nodes…"
                  className="flex-1 min-w-0 bg-[#252525] border border-white/15 rounded px-3 py-1.5 text-xs text-white"
                />
                <button
                  onClick={() => setShowSelectedOnly(v => !v)}
                  className={[
                    "flex-shrink-0 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors",
                    showSelectedOnly
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-[#252525] border-white/15 text-white/50 hover:text-white",
                  ].join(" ")}
                  title="Show selected nodes only"
                >
                  {checkedNodes.size > 0 ? `${checkedNodes.size} ✓` : "✓"}
                </button>
              </div>
              {nodes.length === 0 ? (
                <p className="text-xs text-white/25 italic px-1">
                  {modelUid ? "Click Fetch Nodes to load." : "Load a model first."}
                </p>
              ) : (
                <>
                {filteredNodes.length > 0 && (
                  <SelectAllRow
                    filteredNodes={filteredNodes}
                    checkedNodes={checkedNodes}
                    onToggle={toggleAllFiltered}
                  />
                )}
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {filteredNodes.map(node => {
                    const isChecked = checkedNodes.has(node.name);
                    return (
                      <div key={node.name} className="py-0.5">
                        <label className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleNode(node.name)}
                            className="mt-0.5 flex-shrink-0 accent-blue-500"
                          />
                          <span className="text-xs text-white/60 group-hover:text-white leading-tight break-all">
                            {node.name}
                          </span>
                        </label>
                        {isChecked && selectedOptionId && (
                          <select
                            value={nodeConditions[node.name] ?? ""}
                            onChange={e => setCondition(node.name, e.target.value)}
                            className="mt-1 ml-5 w-[calc(100%-1.25rem)] bg-[#111] border border-white/15 rounded px-2 py-1 text-xs text-white/60"
                          >
                            <option value="">Always Show (Default)</option>
                            {allOptionsFlat
                              .filter(o => o.id !== selectedOptionId)
                              .map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                              ))
                            }
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
                </>
              )}
              {nodes.length > 0 && (
                <p className="text-[10px] text-white/25 mt-2">
                  {filteredNodes.length} / {nodes.length} nodes
                  {checkedNodes.size > 0 && ` · ${checkedNodes.size} selected`}
                </p>
              )}
            </Section>

          </div>

        </div>

        {/* ── Right Panel: 3D Viewer ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/30 border-b border-white/10 bg-[#1a1a1a]">
            3D Viewer
          </div>
          <div className="flex-1 bg-black">
            {modelUid ? (
              <AdminSketchfabViewer
                key={viewerKey}
                modelId={modelUid}
                onApiReady={api => { apiRef.current = api; setApiReady(true); }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white/25 text-sm">
                Select a project to load the 3D viewer
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Toast notification ──────────────────────────────────────────────── */}
      <div
        className={[
          "fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3 rounded-lg shadow-2xl border text-sm font-medium max-w-xs",
          "transition-all duration-300",
          feedback
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none",
          feedback?.ok
            ? "bg-[#0f2a1a] border-green-500/40 text-green-300"
            : "bg-[#2a0f0f] border-red-500/40 text-red-300",
        ].join(" ")}
      >
        <span className="text-base leading-none mt-0.5">
          {feedback?.ok ? "✓" : "✕"}
        </span>
        <span>{feedback?.msg}</span>
      </div>

    </div>
  );
}

// ── Select-all row ────────────────────────────────────────────────────────────
function SelectAllRow({
  filteredNodes,
  checkedNodes,
  onToggle,
}: {
  filteredNodes: { name: string }[];
  checkedNodes: Set<string>;
  onToggle: () => void;
}) {
  const checkedCount = filteredNodes.filter(n => checkedNodes.has(n.name)).length;
  const allChecked   = checkedCount === filteredNodes.length;
  const someChecked  = checkedCount > 0 && !allChecked;
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);

  return (
    <label className="flex items-center gap-2 cursor-pointer group mb-1.5 pb-1.5 border-b border-white/10">
      <input
        ref={ref}
        type="checkbox"
        checked={allChecked}
        onChange={onToggle}
        className="flex-shrink-0 accent-blue-500"
      />
      <span className="text-xs text-white/40 group-hover:text-white/70">
        {allChecked ? "Deselect all" : `Select all (${filteredNodes.length})`}
      </span>
    </label>
  );
}

// ── Shared section wrapper ─────────────────────────────────────────────────────
function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</p>
        {action}
      </div>
      {children}
    </div>
  );
}
