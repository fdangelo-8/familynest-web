"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { PageError } from "@/components/ui/PageError/PageError";

/**
 * Whole-page error of «Calendari collegati»: no partial content, no mail and
 * no calendar name. The bar and the side menu stay; «Riprova» reads the page
 * again.
 */
export function CalendarsError() {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <div className="colonna">
          <PageError
            headingLevel={1}
            retrying={retrying}
            onRetry={() => startTransition(() => router.refresh())}
            exit={{ label: "Torna a Oggi", href: "/oggi" }}
          />
        </div>
      </div>
    </main>
  );
}
