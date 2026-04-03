"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Role-based nav visibility
// artist: requests + node bridge only
// customer_service: requests + support tickets
// editor/manager/super_admin: everything
// viewer: dashboard + analytics only
const NAV_MAIN_ALL = [
  { href: "/admin",               label: "Mission Control",  icon: GridIcon,     exact: true,  roles: ["super_admin","manager","editor","viewer"] },
  { href: "/admin/requests",      label: "Production Queue", icon: QueueIcon,    badge: true,  roles: ["super_admin","manager","editor","viewer","customer_service","artist"] },
  { href: "/admin/builders",      label: "Builder CRM",      icon: BuildingIcon,               roles: ["super_admin","manager","editor"] },
  { href: "/admin/communities",   label: "Site Maps",        icon: MapIcon,                    roles: ["super_admin","manager","editor"] },
  { href: "/admin/analytics",     label: "Analytics",        icon: ChartIcon,                  roles: ["super_admin","manager","editor","viewer"] },
  { href: "/admin/support",       label: "Support Tickets",  icon: TicketIcon,                 roles: ["super_admin","manager","customer_service"] },
];

const NAV_CONFIG_ALL = [
  { href: "/admin/settings", label: "Settings",    icon: GearIcon,  roles: ["super_admin","manager"] },
  { href: "/admin/team",     label: "Team Access", icon: UsersIcon, roles: ["super_admin","manager"] },
];

const TOOLS_ALL = [
  { href: "/admin/node-bridge", label: "Node Bridge", icon: CpuIcon,   roles: ["super_admin","manager","editor","artist"] },
  { href: "/admin/renders",     label: "Renders",     icon: ImageIcon, roles: ["super_admin","manager","editor"] },
];

interface Notif {
  id: string;
  name: string;
  status: string;
  updated_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:      "Super Admin",
  manager:          "Manager",
  editor:           "Editor",
  viewer:           "Viewer",
  customer_service: "Customer Service",
  artist:           "3D Artist",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [pendingCount,  setPendingCount]  = useState<number>(0);
  const [userName,      setUserName]      = useState("Admin User");
  const [userInitials,  setUserInitials]  = useState("AU");
  const [userRole,      setUserRole]      = useState<string>("viewer");
  const [showUser,      setShowUser]      = useState(false);
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [showHelp,      setShowHelp]      = useState(false);
  const [notifs,        setNotifs]        = useState<Notif[]>([]);
  const userRef   = useRef<HTMLDivElement>(null);
  const notifRef  = useRef<HTMLDivElement>(null);
  const helpRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .then(({ count }) => setPendingCount(count ?? 0));

    // Load real user identity and enforce role-based access
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = "/auth/login"; return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("profiles") as any)
        .select("full_name, role")
        .eq("id", user.id)
        .single()
        .then(({ data }: { data: { full_name: string; role: string } | null }) => {
          const role = data?.role ?? "viewer";
          // Builders should not access admin — redirect to their dashboard
          if (role === "builder_admin" || role === "builder_member") {
            window.location.href = "/builder/dashboard";
            return;
          }
          setUserRole(role);
          const name = data?.full_name ?? user.email ?? "Admin User";
          setUserName(name);
          const parts = name.split(" ");
          setUserInitials((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? ""));
        });
    });

    // Load recent project notifications
    supabase
      .from("projects")
      .select("id, name, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(8)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => {
        if (data) setNotifs(data as Notif[]);
      });
  }, []);

  const NAV_MAIN   = NAV_MAIN_ALL.filter(n => n.roles.includes(userRole));
  const NAV_CONFIG = NAV_CONFIG_ALL.filter(n => n.roles.includes(userRole));
  const TOOLS      = TOOLS_ALL.filter(n => n.roles.includes(userRole));

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setShowUser(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (helpRef.current  && !helpRef.current.contains(e.target as Node))  setShowHelp(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? path === href : path.startsWith(href);
  }

  return (
    <div className="flex h-screen bg-[#0c0c0c] text-white overflow-hidden">

      {/* Left gradient accent */}
      <div className="w-0.5 flex-shrink-0 bg-gradient-to-b from-violet-600 via-blue-600 to-violet-800" />

      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 bg-[#111] border-r border-white/8 flex flex-col">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_light.png" alt="ProPlan Studio" className="h-7 object-contain" />
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-medium">Internal Admin</p>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          <div className="space-y-0.5">
            {NAV_MAIN.map(item => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-600/20 text-blue-400"
                      : "text-white/50 hover:text-white hover:bg-white/6"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-400" : "text-white/35"}`} />
                    {item.label}
                  </div>
                  {item.badge && pendingCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 leading-none">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {NAV_CONFIG.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 px-2 mb-1.5">Configuration</p>
            <div className="space-y-0.5">
              {NAV_CONFIG.map(item => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-white/50 hover:text-white hover:bg-white/6"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-400" : "text-white/35"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          )}

          {/* Tools */}
          {TOOLS.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 px-2 mb-1.5">Tools</p>
              <div className="space-y-0.5">
                {TOOLS.map(item => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-white/50 hover:text-white hover:bg-white/6"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-400" : "text-white/35"}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* ── Content Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Header */}
        <header className="flex-shrink-0 h-13 bg-[#111] border-b border-white/8 flex items-center px-5 gap-4">
          {/* Search */}
          <div className="flex-1 max-w-sm">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
              <SearchIcon className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search builders, quotes, models..."
                className="bg-transparent text-xs text-white/60 placeholder-white/25 flex-1 outline-none"
              />
              <span className="text-[10px] text-white/20 bg-white/8 px-1.5 py-0.5 rounded font-mono">⌘K</span>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs(v => !v); setShowUser(false); setShowHelp(false); }}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8 transition-colors">
                <BellIcon className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#1a1a1a] border border-white/12 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                    <p className="text-xs font-bold text-white">Recent Activity</p>
                    {pendingCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400">
                        {pendingCount} pending
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                    {notifs.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-6">No recent activity</p>
                    ) : notifs.map(n => (
                      <Link key={n.id} href={`/admin/requests/${n.id}`}
                        onClick={() => setShowNotifs(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          n.status === "pending_review" ? "bg-amber-400" :
                          n.status === "live" ? "bg-green-400" :
                          n.status === "in_review" ? "bg-violet-400" : "bg-blue-400"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white/70 truncate">{n.name}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {n.status === "pending_review" ? "New Request" :
                             n.status === "in_development" ? "In Progress" :
                             n.status === "in_review" ? "Needs Mapping" :
                             n.status === "live" ? "Live" : n.status}
                            {" · "}
                            {new Date(n.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-white/8">
                    <Link href="/admin/requests" onClick={() => setShowNotifs(false)}
                      className="text-[10px] text-blue-400 hover:underline">
                      View all models →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Help */}
            <div className="relative" ref={helpRef}>
              <button
                onClick={() => { setShowHelp(v => !v); setShowUser(false); setShowNotifs(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8 transition-colors">
                <HelpIcon className="w-4 h-4" />
              </button>
              {showHelp && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#1a1a1a] border border-white/12 rounded-xl shadow-2xl z-50 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 px-3 py-2">Help & Resources</p>
                  {[
                    { label: "Production Queue",    href: "/admin/requests" },
                    { label: "Node Bridge Guide",   href: "/admin/node-bridge" },
                    { label: "Builder CRM",         href: "/admin/builders" },
                    { label: "Team Access",         href: "/admin/team" },
                  ].map(item => (
                    <Link key={item.href} href={item.href}
                      onClick={() => setShowHelp(false)}
                      className="block px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/8 transition-colors">
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* User identity */}
            <div className="relative ml-1" ref={userRef}>
              <div
                onClick={() => { setShowUser(v => !v); setShowNotifs(false); setShowHelp(false); }}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/8 transition-colors cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white uppercase">{userInitials || "AU"}</span>
                </div>
                <span className="text-xs text-white/70 font-medium max-w-[100px] truncate">{userName}</span>
                <ChevronIcon className="w-3 h-3 text-white/30" />
              </div>
              {showUser && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#1a1a1a] border border-white/12 rounded-xl shadow-2xl z-50 py-1.5">
                  <div className="px-3 py-2.5 border-b border-white/8">
                    <p className="text-xs font-semibold text-white truncate">{userName}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">{ROLE_LABEL[userRole] ?? "Admin"}</p>
                  </div>
                  <Link href="/admin/settings"
                    onClick={() => setShowUser(false)}
                    className="block px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/8 transition-colors">
                    Settings
                  </Link>
                  <Link href="/admin/team"
                    onClick={() => setShowUser(false)}
                    className="block px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/8 transition-colors">
                    Team Access
                  </Link>
                  <div className="border-t border-white/8 mt-1 pt-1">
                    <button onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-white/5 transition-colors">
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function QueueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10"/>
    </svg>
  );
}
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0H5m-2 0h2M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>
  );
}
function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  );
}
function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <path strokeLinecap="round" d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>
    </svg>
  );
}
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21"/>
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    </svg>
  );
}
function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
    </svg>
  );
}
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
    </svg>
  );
}
function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
    </svg>
  );
}
function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}
