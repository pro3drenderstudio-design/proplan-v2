import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

// Bricolage Grotesque — wide, confident display font; works beautifully at large sizes
const bricolage = Bricolage_Grotesque({
  variable: "--font-syne",   // keeps same CSS var — no other file changes needed
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProPlan Studio — Sell Homes Before They're Built",
  description:
    "Interactive 3D configurators, AI renders, professional studio rendering, and interactive site maps for home builders.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
