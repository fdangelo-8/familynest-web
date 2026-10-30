"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import {
  accessErrorText,
  PROVIDER_NAME,
  startOAuthSignIn,
  type AccessError,
  type Provider,
} from "@/lib/auth/oauth";
import styles from "./accesso.module.css";
import { Brand, Claim, LegalLine, Stickers } from "./parts";

export type { AccessError, Provider };

function ErrorNotice({
  error,
  focusOnMount,
  onRetry,
}: {
  error: AccessError;
  focusOnMount: boolean;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Arriving from the provider: the screen reader reads the error at once.
    if (focusOnMount) ref.current?.focus();
    // Only when the notice appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cx(
        "avviso",
        error.cancelled ? "avviso--info" : "avviso--errore",
      )}
      role={error.cancelled ? "status" : "alert"}
      tabIndex={-1}
      ref={ref}
    >
      <Icon name={error.cancelled ? "info" : "wifi-off"} />
      <p className="avviso__testo">{accessErrorText(error)}</p>
      <Button variant="link" onClick={onRetry}>
        Riprova
      </Button>
    </div>
  );
}

/**
 * Sign-in page (mockup 01): two layouts in one <main>, one visible at a time.
 * Apple and Google start from the browser; the return is /auth/callback.
 */
export function AccessScreen({
  initialError,
}: {
  initialError: AccessError | null;
}) {
  const [error, setError] = useState<AccessError | null>(initialError);
  const [fromServer, setFromServer] = useState(initialError !== null);
  const [loading, setLoading] = useState<Provider | null>(null);
  const busy = useRef(false);

  // Coming back from the provider with the browser's back button: the page
  // is restored from the cache, no button stays in loading.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        busy.current = false;
        setLoading(null);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function signIn(provider: Provider) {
    if (busy.current) return;
    setFromServer(false);
    setError(null);
    if (!navigator.onLine) {
      setError({ provider, cancelled: false });
      return;
    }
    busy.current = true;
    setLoading(provider);
    const result = await startOAuthSignIn(provider);
    // `started`: the browser is going to the provider's page, the loading state stays.
    if (result === "failed") {
      busy.current = false;
      setLoading(null);
      setError({ provider, cancelled: false });
    }
  }

  function retry() {
    if (error?.provider) {
      void signIn(error.provider);
    } else {
      setFromServer(false);
      setError(null);
    }
  }

  const notice = error ? (
    <ErrorNotice error={error} focusOnMount={fromServer} onRetry={retry} />
  ) : null;

  function providerButton(
    provider: Provider,
    variant: "chiaro" | "primary" | "secondary",
  ) {
    return (
      <Button
        variant={variant}
        full
        icon={provider === "apple" ? "apple" : undefined}
        loading={loading === provider}
        disabled={loading !== null && loading !== provider}
        onClick={() => void signIn(provider)}
      >
        {loading === provider
          ? `Accesso con ${PROVIDER_NAME[provider]} in corso`
          : `Continua con ${PROVIDER_NAME[provider]}`}
      </Button>
    );
  }

  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <div className="intestazione">
          <Stickers />
        </div>
        <div className="dialogo__azioni">
          <Claim as="h1" />
          {notice}
          <div className="dialogo__azioni">
            {providerButton("apple", "chiaro")}
            {providerButton("google", "chiaro")}
            <div className="gruppo-chip">
              <Button variant="link" href="/accesso/mail">
                Usa la mail
              </Button>
            </div>
            <LegalLine className="legale" />
          </div>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <span />
          <div className="sezione">
            <div className="intestazione">
              <p className="intestazione__sopra">Benvenuto</p>
              <h1 className="intestazione__titolo t-titolo-pagina">
                Entra in FamilyNest
              </h1>
              <p className="intestazione__sotto">
                Il calendario, la spesa e le cose da fare di chi vive con te, in
                un posto solo.
              </p>
            </div>
            {notice}
            <div className="dialogo__azioni">
              {providerButton("apple", "primary")}
              {providerButton("google", "secondary")}
              <div className="gruppo-chip">
                <Button variant="link" href="/accesso/mail">
                  Usa la mail
                </Button>
              </div>
            </div>
          </div>
          <LegalLine className="t-nota t-secondario" />
        </div>
      </div>
    </main>
  );
}
