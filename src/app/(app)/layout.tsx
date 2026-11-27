import { Suspense } from "react";
import { BarActionProvider } from "@/components/ui/AppFrame/BarAction";
import { BottomNav } from "@/components/ui/AppFrame/BottomNav";
import { DesktopBar } from "@/components/ui/AppFrame/DesktopBar";
import { FrameError } from "@/components/ui/AppFrame/FrameError";
import { NestProvider } from "@/components/ui/AppFrame/NestProvider";
import { NotificationCountProvider } from "@/components/ui/AppFrame/NotificationCount";
import { PhoneHeader } from "@/components/ui/AppFrame/PhoneHeader";
import { Shell } from "@/components/ui/AppFrame/Shell";
import { ShortcutsProvider } from "@/components/ui/AppFrame/Shortcuts";
import { SideNav } from "@/components/ui/AppFrame/SideNav";
import { SkipLink } from "@/components/ui/AppFrame/SkipLink";
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
      startLens={frame.startLens}
      defaultVisibility={frame.defaultVisibility}
    >
      <NotificationCountProvider initialCount={frame.unreadNotifications}>
        <BarActionProvider>
          <ShortcutsProvider>
            <SkipLink />
            <Shell sidebar={<SideNav />}>
              <PhoneHeader />
              <DesktopBar />
              {frame.failed ? <FrameError /> : children}
              <BottomNav />
            </Shell>
            {frame.failed ? null : modal}
          </ShortcutsProvider>
        </BarActionProvider>
      </NotificationCountProvider>
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
