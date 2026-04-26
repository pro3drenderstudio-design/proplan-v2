import type { Metadata } from "next";
import { Bricolage_Grotesque, Cormorant_Garamond, DM_Sans, Jost } from "next/font/google";
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

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  display: "block",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["200", "300"],
  display: "block",
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
      className={`${bricolage.variable} ${dmSans.variable} ${cormorant.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
