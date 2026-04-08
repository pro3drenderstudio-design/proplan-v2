"use client";

import { Project } from "@/types/database";

interface ProjectInfoCardProps {
  project: Project;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function ProjectInfoCard({ project }: ProjectInfoCardProps) {
  const stats = [
    project.beds   != null && { label: "Bed",   value: project.beds   },
    project.baths  != null && { label: "Bath",  value: project.baths  },
    project.floors != null && { label: "Floor", value: project.floors },
    project.sqft   != null && { label: "sqft",  value: project.sqft?.toLocaleString() },
  ].filter(Boolean) as { label: string; value: string | number }[];

  return (
    <div className="hidden sm:block absolute left-4 bottom-24 z-50 w-52">
      <div
        className="rounded-2xl p-4"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Name */}
        <p
          className="text-sm font-extrabold text-white truncate leading-tight"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          {project.name}
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
          by ProPlan Studio
        </p>

        {/* Base price */}
        <div className="mb-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Base Price</p>
          <p className="text-xl font-extrabold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            {fmt(project.base_price ?? 0)}
          </p>
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>{s.label}</p>
                <p className="text-xs font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
