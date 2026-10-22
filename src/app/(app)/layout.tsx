import { Suspense } from "react";
import { AppBar } from "@/components/ui/AppFrame/AppBar";
import { BottomNav } from "@/components/ui/AppFrame/BottomNav";
import { FrameError } from "@/components/ui/AppFrame/FrameError";
import { NestProvider } from "@/components/ui/AppFrame/NestProvider";
import { SearchShortcut } from "@/components/ui/AppFrame/SearchShortcut";
import { TopNav } from "@/components/ui/AppFrame/TopNav";
import { loadNestFrame } from "@/lib/nest-frame";

// The session is checked on the server on every request (no middleware).
// Reading the session is request-time data, so it sits inside <Suspense>.
async function AppFrame({ children }: { children: React.ReactNode }) {
  // Redirects to /accesso or /onboarding when the user cannot see the frame.
  const frame = await loadNestFrame();

  return (
    <NestProvider nestName={frame.nestName} members={frame.members}>
      <SearchShortcut />
      <AppBar />
      <TopNav />
      {frame.failed ? <FrameError /> : children}
      <BottomNav />
    </NestProvider>
  );
}

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}
