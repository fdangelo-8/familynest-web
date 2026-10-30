"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { PageError } from "@/components/ui/PageError/PageError";

/**
 * Whole-page error of the member page: no partial content. The bar and the
 * side menu stay; «Riprova» reads the page again.
 */
export function MemberError() {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <div className="colonna">
          <PageError
            headingLevel={1}
            icon="circle-alert"
            retrying={retrying}
            onRetry={() => startTransition(() => router.refresh())}
            exit={{ label: "Torna a Oggi", href: "/oggi" }}
          />
        </div>
      </div>
    </main>
  );
}
