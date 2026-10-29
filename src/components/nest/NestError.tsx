"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErrorMain } from "@/components/ui/AppFrame/ErrorMain";

/** Whole-page error of "Il tuo Nest": no partial content, "Riprova" reads again. */
export function NestError() {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();

  return (
    <ErrorMain
      retrying={retrying}
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
