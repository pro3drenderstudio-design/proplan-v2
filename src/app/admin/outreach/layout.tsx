"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/outreach",            label: "Overview",   exact: true  },
  { href: "/admin/outreach/inboxes",    label: "Inboxes"                  },
  { href: "/admin/outreach/leads",      label: "Leads"                    },
  { href: "/admin/outreach/campaigns",  label: "Campaigns"                },
  { href: "/admin/outreach/crm",        label: "CRM"                      },
  { href: "/admin/outreach/templates",  label: "Templates"                },
  { href: "/admin/outreach/warmup",     label: "Warmup"                   },
  { href: "/admin/outreach/settings",   label: "Settings"                 },
];

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav */}
      <div className="border-b border-white/8 px-6 py-3 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
        <span className="text-white/30 text-xs font-semibold uppercase tracking-widest mr-3">Outreach</span>
        {TABS.map((tab) => {
          const active = tab.exact ? path === tab.href : path.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
