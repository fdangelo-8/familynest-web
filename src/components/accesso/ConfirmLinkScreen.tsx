"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { AuthLayout, Intro } from "./AuthLayout";
import styles from "./accesso.module.css";

export type ConfirmLinkProps = {
  /** Data of the link: they go back in the body of the POST, never in an address */
  tokenHash: string;
  type: "email" | "signup";
  next?: string;
  /** Somebody is already signed in in this browser (read on the server) */
  current?: { email: string; destination: string };
};

/**
 * `/auth/confirm` for the confirmation links (#419). Opening the link does not
 * use it: the button posts it. Works without scripts (native submit); with
 * scripts the button shows the loading state and a second click is ignored.
 */
export function ConfirmLinkScreen({
  tokenHash,
  type,
  next,
  current,
}: ConfirmLinkProps) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  // Page restored from the cache with the back button: no stuck loading state.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        busy.current = false;
        setPending(false);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (busy.current) {
      event.preventDefault();
      return;
    }
    // The native submit goes on: only the button changes.
    busy.current = true;
    setPending(true);
  }

  return (
    <AuthLayout
      back={null}
      intro={
        <Intro eyebrow="Registrazione" title="Conferma il tuo indirizzo">
          Tocca il bottone per confermare la mail ed entrare in FamilyNest.
        </Intro>
      }
      form={{
        id: "accesso-conferma-modulo",
        action: "/auth/confirm",
        onSubmit: handleSubmit,
      }}
      body={
        <>
          {/* Data of the link, not written by the person: they need a name. */}
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {current ? (
            <Alert variant="info" icon="user-round">
              In questo browser sei dentro con{" "}
              <b className={styles.address}>{current.email}</b>. Se confermi,
              esci da questo account ed entri con quello della mail.
            </Alert>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="primary" type="submit" full loading={pending}>
            {pending ? "Conferma in corso" : "Conferma l'indirizzo"}
          </Button>
          {current ? (
            <div className="gruppo-chip">
              <Button
                variant="link"
                href={current.destination}
                inactive={pending}
              >
                Resta con questo account
              </Button>
            </div>
          ) : null}
        </>
      }
    />
  );
}
