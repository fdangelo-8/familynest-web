"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button/Button";
import { clearLens } from "@/lib/lens";
import { clearAllRecentSearches } from "@/lib/recent-searches";
import styles from "./accesso.module.css";

/**
 * «Per l'account <mail>.»: the address comes from the session, read on the
 * server, never from the address of the page. It wraps where needed.
 */
export function AccountSentence({ email }: { email: string }) {
  return (
    <span data-testid="account-attivo">
      Per l&apos;account <strong className={styles.address}>{email}</strong>.
    </span>
  );
}

/**
 * «Non sei tu? Esci»: POST to /auth/signout (a GET does nothing), then back to
 * /accesso. Same clean-up of the local data as `SignOutForm`. The page can
 * disable it (`disabled`) and learn when the exit starts or is undone (`onPendingChange`).
 */
export function SignOutLink({
  disabled = false,
  onPendingChange,
}: {
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  // Page restored from the cache with the back button: no stuck loading state.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setLoading(false);
        onPendingChange?.(false);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [onPendingChange]);

  return (
    <form
      method="post"
      action="/auth/signout"
      className="gruppo-chip"
      onSubmit={(event) => {
        if (loading || disabled) {
          event.preventDefault();
          return;
        }
        // The recent searches stay in this browser only: they leave with the person.
        clearAllRecentSearches();
        clearLens();
        setLoading(true);
        onPendingChange?.(true);
      }}
    >
      <Button
        type="submit"
        variant="link-secondario"
        loading={loading}
        disabled={disabled && !loading}
      >
        {loading ? "Uscita in corso" : "Non sei tu? Esci"}
      </Button>
    </form>
  );
}
