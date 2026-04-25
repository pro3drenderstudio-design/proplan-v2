"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import CalendlyButton from "@/components/CalendlyButton";

const PRODUCTS = [
  {
    href: "/products/configurator",
    name: "3D Configurator",
    desc: "Interactive home models buyers configure live",
    dot: "bg-blue-400",
    grad: "from-blue-500/15 to-transparent",
  },
  {
    href: "/products/ai-renders",
    name: "AI Render Studio",
    desc: "Floor plan → photorealistic render in seconds",
    dot: "bg-amber-400",
    grad: "from-amber-500/15 to-transparent",
  },
  {
    href: "/products/3d-rendering",
    name: "3D Rendering Service",
    desc: "Hand-crafted by our studio — 48hr turnaround",
    dot: "bg-violet-400",
    grad: "from-violet-500/15 to-transparent",
  },
  {
    href: "/products/site-maps",
    name: "Interactive Site Maps",
    desc: "Lot selection linked to buyer configurators",
    dot: "bg-teal-400",
    grad: "from-teal-500/15 to-transparent",
  },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Delayed close — prevents dropdown vanishing when mouse crosses the gap
  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#080808]/90 backdrop-blur-xl border-b border-white/8 shadow-2xl shadow-black/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_light.png" alt="ProPlan Studio" className="h-7 object-contain" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {/* Products dropdown — outer div covers button + panel to preserve hover */}
          <div
            className="relative"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
          >
            <button className="flex items-center gap-1 px-3.5 py-2 text-sm text-white/55 hover:text-white rounded-lg hover:bg-white/5 transition-all">
              Products
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/*
              Dropdown wrapper: starts flush with the button (top-full),
              with invisible top-padding that bridges the visual gap so the
              cursor never leaves the hover zone while moving from button → panel.
            */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[480px]"
              style={{ pointerEvents: open ? "auto" : "none" }}
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
            >
              <div
                className={`rounded-2xl bg-[#0e0e0e] border border-white/10 shadow-2xl shadow-black/60 p-2.5 grid grid-cols-2 gap-2
                  transition-all duration-200 ${open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
              >
                {PRODUCTS.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className={`flex items-start gap-3 p-3.5 rounded-xl bg-gradient-to-br ${p.grad} border border-white/5 hover:border-white/14 transition-all`}
                  >
                    <div className={`w-2 h-2 rounded-full ${p.dot} mt-1.5 flex-shrink-0`} />
                    <div>
                      <p className="text-[13px] font-semibold text-white mb-0.5">{p.name}</p>
                      <p className="text-[11px] text-white/35 leading-relaxed">{p.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {[
            { label: "Pricing",      href: "/pricing"       },
            { label: "How it works", href: "/#how-it-works" },
          ].map((n) => (
            <Link key={n.label} href={n.href}
              className="px-3.5 py-2 text-sm text-white/55 hover:text-white rounded-lg hover:bg-white/5 transition-all">
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href="/auth/login"
            className="hidden sm:flex px-4 py-2 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-all">
            Sign in
          </Link>
          <CalendlyButton className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20">
            Book a Demo
            <svg className="w-3.5 h-3.5 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </CalendlyButton>
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/8 transition-colors text-white/60 hover:text-white"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0e0e0e]/95 backdrop-blur-xl border-b border-white/8 px-4 py-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 px-2 mb-2">Products</p>
          <div className="space-y-0.5">
            {PRODUCTS.map(p => (
              <Link key={p.href} href={p.href} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                <div className={`w-2 h-2 rounded-full ${p.dot} flex-shrink-0`} />
                <span className="text-sm text-white/70">{p.name}</span>
              </Link>
            ))}
          </div>
          <div className="border-t border-white/8 pt-2 mt-3 space-y-0.5">
            <Link href="/pricing" onClick={() => setMobileOpen(false)}
              className="block px-2 py-2.5 text-sm text-white/70 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
              Pricing
            </Link>
            <Link href="/#how-it-works" onClick={() => setMobileOpen(false)}
              className="block px-2 py-2.5 text-sm text-white/70 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
              How it works
            </Link>
            <Link href="/auth/login" onClick={() => setMobileOpen(false)}
              className="block px-2 py-2.5 text-sm text-white/70 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
              Sign in
            </Link>
            <CalendlyButton className="block w-full text-left px-2 py-2.5 text-sm font-semibold text-blue-400 hover:text-blue-300 rounded-xl hover:bg-white/5 transition-colors">
              Book a Demo
            </CalendlyButton>
          </div>
        </div>
      )}
    </header>
  );
}
