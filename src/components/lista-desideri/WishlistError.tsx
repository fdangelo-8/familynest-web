"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageError } from "@/components/ui/PageError/PageError";

/**
 * Whole-page error when the server could not check the child: no partial
 * content, no «+». «Riprova» reads the page again.
 */
export function WishlistError() {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <PageError
        headingLevel={1}
        retrying={retrying}
        onRetry={() => startTransition(() => router.refresh())}
        exit={{ label: "Torna a Oggi", href: "/oggi" }}
      />
    </main>
  );
}
