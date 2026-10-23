"use client";

import { useState } from "react";
import { ErrorMain } from "@/components/ui/AppFrame/ErrorMain";

/** A page of the app failed: bars stay, the page area shows the error. */
export default function AppError({ retry }: { retry: () => void }) {
  const [retrying, setRetrying] = useState(false);

  return (
    <ErrorMain
      retrying={retrying}
      onRetry={() => {
        setRetrying(true);
        // Re-fetches the data and re-renders (the older prop only re-renders).
        retry();
      }}
    />
  );
}
