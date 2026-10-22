import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilyNest",
  description: "FamilyNest — l'organizer per la tua famiglia",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
