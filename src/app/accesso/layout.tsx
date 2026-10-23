import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "FamilyNest · Accesso",
};

// Shared by /accesso, /accesso/mail and /accesso/link-scaduto. Each page
// checks the session itself (a layout is not a guard). Reading the session is
// request-time data, so it sits inside <Suspense>.
export default function AccessoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
