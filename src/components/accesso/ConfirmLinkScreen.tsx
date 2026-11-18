"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { AuthLayout, Intro } from "./AuthLayout";
import styles from "./accesso.module.css";

export type ConfirmLinkProps = {
  /** Data of the link: they go back in the body of the POST, never in an address */
  tokenHash: string;
  /** `recovery` is the link of «Password dimenticata» (#461, posts to /auth/recupero) */
  type: "email" | "signup" | "recovery";
  next?: string;
  /** Somebody is already signed in in this browser (read on the server) */
  current?: { email: string; destination: string };
};

// Texts of the two pages. The recovery ones (#461) are those of the designer's
// comment in the issue.
const COPY = {
  confirm: {
    id: "accesso-conferma-modulo",
    action: "/auth/confirm",
    eyebrow: "Registrazione",
    title: "Conferma il tuo indirizzo",
    lead: "Tocca il bottone per confermare la mail ed entrare in FamilyNest.",
    button: "Conferma l'indirizzo",
    busy: "Conferma in corso",
    // Between the address and the end of the sentence.
    other:
      "Se confermi, esci da questo account ed entri con quello della mail.",
  },
  recovery: {
    id: "accesso-recupero-modulo",
    action: "/auth/recupero",
    eyebrow: "Password dimenticata",
    title: "Hai chiesto una nuova password",
    lead: "Tocca il bottone per sceglierla.",
    button: "Scegli una nuova password",
    busy: "Apertura in corso",
    other:
      "Se continui, esci da questo account e scegli la password di quello della mail.",
  },
} as const;

/**
 * `/auth/confirm` for the confirmation links (#419) and for the link of the new
 * password (#461, button posts to `/auth/recupero`). Opening the link does not
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
  const copy = type === "recovery" ? COPY.recovery : COPY.confirm;

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
        <Intro eyebrow={copy.eyebrow} title={copy.title}>
          {copy.lead}
        </Intro>
      }
      form={{
        id: copy.id,
        action: copy.action,
        onSubmit: handleSubmit,
      }}
      body={
        <>
          {/* Data of the link, not written by the person: they need a name. */}
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          {next && type !== "recovery" ? (
            <input type="hidden" name="next" value={next} />
          ) : null}
          {current ? (
            <Alert variant="info" icon="user-round">
              In questo browser sei dentro con{" "}
              <b className={styles.address}>{current.email}</b>. {copy.other}
            </Alert>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="primary" type="submit" full loading={pending}>
            {pending ? copy.busy : copy.button}
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
