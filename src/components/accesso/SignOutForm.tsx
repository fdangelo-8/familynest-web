"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button/Button";

/**
 * "Esci": POST to /auth/signout (the only way: a GET does nothing). Closes the
 * session of this device and goes back to /accesso. No confirmation (#38 may add one).
 */
export function SignOutForm() {
  const [loading, setLoading] = useState(false);

  // Page restored from the cache with the back button: no stuck loading state.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLoading(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <form
      method="post"
      action="/auth/signout"
      onSubmit={() => setLoading(true)}
    >
      <Button
        type="submit"
        variant="secondary"
        full
        icon="log-out"
        loading={loading}
      >
        {loading ? "Uscita in corso" : "Esci"}
      </Button>
    </form>
  );
}
