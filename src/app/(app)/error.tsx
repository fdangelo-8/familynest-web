"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { PageError } from "@/components/ui/PageError/PageError";

/** A page of the app failed: bars stay, the page area shows the error. */
export default function AppError({ reset }: { reset: () => void }) {
  const pathname = usePathname();
  const [retrying, setRetrying] = useState(false);
  // On mobile the h1 "Casa" is already in the top bar.
  const isCasa = pathname === "/casa" || pathname.startsWith("/casa/");

  return (
    <main className="pagina pagina-desktop pagina-desktop--centrata">
      <PageError
        headingLevel={isCasa ? 2 : 1}
        icon="circle-alert"
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          reset();
        }}
      />
    </main>
  );
}
