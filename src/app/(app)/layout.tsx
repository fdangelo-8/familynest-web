import { Suspense } from "react";
import { AddShortcut } from "@/components/ui/AppFrame/AddShortcut";
import { AppBar } from "@/components/ui/AppFrame/AppBar";
import { BottomNav } from "@/components/ui/AppFrame/BottomNav";
import { FrameError } from "@/components/ui/AppFrame/FrameError";
import { NestProvider } from "@/components/ui/AppFrame/NestProvider";
import { SkipLink } from "@/components/ui/AppFrame/SkipLink";
import { SearchShortcut } from "@/components/ui/AppFrame/SearchShortcut";
import { TopNav } from "@/components/ui/AppFrame/TopNav";
import { requireNest } from "@/lib/nest-frame";

// The layout is NOT a guard for page content: every page that reads data
// calls `requireNest()` first (see src/lib/nest-frame.ts).
// The session is checked on the server on every request (no middleware).
// Reading the session is request-time data, so it sits inside <Suspense>.
async function AppFrame({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  // Redirects to /accesso or /onboarding when the user cannot see the frame.
  const frame = await requireNest();

  return (
    <NestProvider
      nestName={frame.nestName}
      members={frame.members}
      me={frame.me}
    >
      <SkipLink />
      <SearchShortcut />
      <AddShortcut />
      <AppBar />
      <TopNav />
      {frame.failed ? <FrameError /> : children}
      <BottomNav />
      {frame.failed ? null : modal}
    </NestProvider>
  );
}

export default function AppLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <AppFrame modal={modal}>{children}</AppFrame>
    </Suspense>
  );
}
