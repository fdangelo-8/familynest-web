"use client";

import { Button } from "@/components/ui/Button/Button";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { PageHeader } from "./PageHeader";
import { MARK_ALL_LABEL } from "./texts";

/**
 * The page while it opens: the header (with «Segna tutte come lette»
 * disabled) and the shapes of the summary and of three rows. Used by
 * `loading.tsx` and by the page itself while it reads.
 */
export function NotificationsLoading() {
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      <PageHeader>
        <Button variant="secondary" small icon="check" disabled>
          {MARK_ALL_LABEL}
        </Button>
      </PageHeader>
      <SkeletonGroup aria-live="polite">
        <Skeleton shape="grande" />
        <Skeleton shape="testo-corto" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
      </SkeletonGroup>
    </main>
  );
}
