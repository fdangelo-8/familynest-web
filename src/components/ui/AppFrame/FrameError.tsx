"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { PageError } from "../PageError/PageError";

/** Page-wide error shown inside the frame when the Nest data could not be read. */
export function FrameError() {
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
        retrying={retrying}
        onRetry={retry}
      />
    </main>
  );
}
