"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { ErrorMain } from "./ErrorMain";

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

  return <ErrorMain retrying={retrying} onRetry={retry} />;
}
