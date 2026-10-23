import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FamilyNest · Accesso",
};

// Shared by /accesso, /accesso/mail and /accesso/link-scaduto. Each page
// checks the session itself (a layout is not a guard).
export default function AccessoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
