"use client";

import { useState } from "react";

const CALENDLY_URL = "https://calendly.com/proplanstudiollc/30min";

interface CalendlyButtonProps {
  children: React.ReactNode;
  className?: string;
  as?: "button" | "a";
}

export default function CalendlyButton({ children, className, as: Tag = "button" }: CalendlyButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tag
        className={className}
        {...(Tag === "a"
          ? { href: "#", onClick: (e: React.MouseEvent) => { e.preventDefault(); setOpen(true); } }
          : { onClick: () => setOpen(true) })}
      >
        {children}
      </Tag>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl bg-white" style={{ height: 680 }}>
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-gray-700 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <iframe
              src={`${CALENDLY_URL}?hide_gdpr_banner=1&hide_landing_page_details=1&background_color=ffffff`}
              width="100%"
              height="100%"
              frameBorder="0"
              title="Schedule a Demo"
            />
          </div>
        </div>
      )}
    </>
  );
}
