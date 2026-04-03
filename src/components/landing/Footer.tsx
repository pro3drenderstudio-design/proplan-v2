import Link from "next/link";

const COLS = [
  {
    heading: "Products",
    links: [
      { label: "3D Configurator",       href: "/products/configurator"  },
      { label: "AI Render Studio",      href: "/products/ai-renders"    },
      { label: "3D Rendering Service",  href: "/products/3d-rendering"  },
      { label: "Interactive Site Maps", href: "/products/site-maps"     },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About",   href: "#" },
      { label: "Pricing", href: "/pricing" },
      { label: "Blog",    href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy",    href: "#" },
      { label: "Terms of Service",  href: "#" },
      { label: "Security",          href: "#" },
      { label: "Cookie Policy",     href: "#" },
    ],
  },
  {
    heading: "Connect",
    links: [
      { label: "LinkedIn",     href: "#" },
      { label: "X (Twitter)",  href: "#" },
      { label: "Instagram",    href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/6 bg-[#080808] py-16 px-5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_light.png" alt="ProPlan Studio" className="h-7 object-contain mb-4" />
            <p className="text-sm text-white/35 leading-relaxed max-w-xs mb-5">
              The complete visual sales platform for home builders — 3D configurators, renders, AI images, and lead capture in one subscription.
            </p>
            <p className="text-[11px] text-white/18">Built for builders who close more.</p>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.heading}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/22 mb-4">
                {col.heading}
              </p>
              <div className="space-y-2.5">
                {col.links.map((l) => (
                  <Link key={l.label} href={l.href}
                    className="block text-sm text-white/38 hover:text-white/70 transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/6 gap-3">
          <p className="text-xs text-white/18">© {new Date().getFullYear()} ProPlan Studio. All rights reserved.</p>
          <p className="text-xs text-white/14">Renders produced by our in-house studio · 48hr avg turnaround</p>
        </div>
      </div>
    </footer>
  );
}
