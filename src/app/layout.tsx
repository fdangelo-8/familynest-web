import type { Metadata, Viewport } from "next";
import { Host_Grotesk, Parkinsans } from "next/font/google";
import { IconSprite } from "@/components/ui/Icon/IconSprite";
import { ToastProvider } from "@/components/ui/Toast/ToastProvider";
import "./globals.css";
import "./components.css";

// Fonts are downloaded at build time and served from the app domain:
// the browser never contacts Google (privacy, decision D-1).
const parkinsans = Parkinsans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-parkinsans",
});

const hostGrotesk = Host_Grotesk({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-host-grotesk",
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
    <html
      lang="it"
      className={`${parkinsans.variable} ${hostGrotesk.variable}`}
    >
      <body>
        <IconSprite />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
