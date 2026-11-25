import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { IconSprite } from "@/components/ui/Icon/IconSprite";
import { ToastProvider } from "@/components/ui/Toast/ToastProvider";
import { getLocale } from "@/lib/i18n";
import "./globals.css";
import "./components.css";

// Fonts are downloaded at build time and served from the app domain:
// the browser never contacts Google (privacy, decision D-1).
// Figtree is a variable font (no `weight`), with the adjusted fallback font
// and preload left on (#196).
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "FamilyNest",
  description: "FamilyNest — l'organizer per la tua famiglia",
};

// viewport-fit=cover lets the bars use the safe areas of phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={getLocale()} className={figtree.variable}>
      <body>
        <IconSprite />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
