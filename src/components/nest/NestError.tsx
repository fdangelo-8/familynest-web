"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageError } from "@/components/ui/PageError/PageError";

/** Whole-page error of "Il tuo Nest": no partial content, "Riprova" reads again. */
export function NestError() {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      <PageError
        headingLevel={1}
        icon="circle-alert"
        retrying={retrying}
        onRetry={() => startTransition(() => router.refresh())}
      />
    </main>
  );
}
