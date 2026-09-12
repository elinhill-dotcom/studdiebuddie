import type { Metadata } from "next";
import { Cormorant_Garamond, Nunito, Outfit } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

/** Matchar den rundade sans-serifen i Studdiebuddie-loggan */
const logo = Nunito({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Studdiebuddie",
  description:
    "Elegant läxplanering för 11–15: kalender, påminnelser, förhör och resultat.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Studdiebuddie",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} ${logo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
