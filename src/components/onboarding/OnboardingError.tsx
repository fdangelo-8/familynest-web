"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { PageError } from "@/components/ui/PageError/PageError";

/**
 * Whole-page error of the onboarding. Whoever is here has no Nest yet, so
 * there is nowhere to go back to: only the text and "Riprova".
 */
export function OnboardingError() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    setRetrying(true);
    startTransition(() => {
      router.refresh();
      setRetrying(false);
    });
  };

  return (
    <main className="pagina pagina-desktop pagina-desktop--centrata">
      <PageError
        headingLevel={1}
        icon="circle-alert"
        text="Controlla la connessione e riprova."
        retrying={retrying}
        onRetry={retry}
      />
    </main>
  );
}
