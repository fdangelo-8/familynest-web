"use client";

import { usePathname } from "next/navigation";
import { isCasaRoute } from "@/lib/app-routes";
import { PageError } from "../PageError/PageError";

/**
 * Page area for a page-wide error, with exactly one visible h1 at every width.
 * On Casa the h1 "Casa" is in the mobile top bar, so there the error title is
 * an h2 and, from 1024 px, an h1 "Casa" in the page header takes its place.
 */
export function ErrorMain({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const pathname = usePathname();
  const isCasa = isCasaRoute(pathname);

  return (
    <main className="pagina pagina-desktop pagina-desktop--centrata">
      {isCasa ? (
        <div className="intestazione-desktop">
          <h1 className="t-titolo-pagina">Casa</h1>
        </div>
      ) : null}
      <PageError
        headingLevel={isCasa ? 2 : 1}
        icon="circle-alert"
        retrying={retrying}
        onRetry={onRetry}
      />
    </main>
  );
}
