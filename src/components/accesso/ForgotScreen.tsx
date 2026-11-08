"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button/Button";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout, Intro, ToAccessLink, ToAccessRow } from "./AuthLayout";
import { callbackUrl, isRateLimit, seconds, validateEmail } from "./fields";
import { MailField } from "./MailField";
import { HintList, NetworkNotice, type HintRow } from "./notices";
import styles from "./accesso.module.css";
import { useCooldown } from "./useCooldown";

const TEXT = {
  empty: "Scrivi la tua mail per ricevere il link.",
  network:
    "Non siamo riusciti a mandare il link. Controlla la connessione e riprova.",
  sending: "Invio del link in corso",
  resent: "Nuovo link mandato: usa quello più recente.",
} as const;

const ROWS: ReadonlyArray<HintRow> = [
  { icon: "clock", title: "Vale un'ora", info: "E funziona una volta sola." },
  {
    icon: "link",
    title: "Apri il link su questo browser",
    info: "Altrove non funziona. Se la posta lo apre in un'altra app, copialo e incollalo qui.",
  },
  {
    icon: "search",
    title: "Non la trovi?",
    info: "È in inglese e potrebbe finire nella posta indesiderata. Se non arriva, forse l'account usa un'altra mail.",
  },
];

/** `ok` also covers 429: the screen must not tell which mails have an account. */
async function requestLink(email: string): Promise<"ok" | "network"> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl("password"),
    });
    if (!error || isRateLimit(error)) return "ok";
    return "network";
  } catch {
    return "network";
  }
}

/**
 * `/accesso/password-dimenticata`: the address, then «Ti abbiamo scritto».
 * The answer is the same for mails with and without an account, also when
 * Supabase says "too many requests" (#327, D2). The address lives only in
 * memory: never in the URL.
 */
export function ForgotScreen() {
  const { showToast } = useToast();
  const cooldown = useCooldown();

  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const busy = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Focus: «Ti abbiamo scritto» -> the title; the form -> the field, only from 1024 px.
  useEffect(() => {
    if (view === "sent") {
      titleRef.current?.focus();
    } else if (window.matchMedia("(min-width: 1024px)").matches) {
      emailRef.current?.focus();
    }
  }, [view]);

  async function send(address: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    const outcome = await requestLink(address);
    busy.current = false;
    setPending(false);
    if (outcome === "network") {
      setFailed(true);
      return;
    }
    if (view === "sent") showToast({ text: TEXT.resent, withoutNav: true });
    setView("sent");
    cooldown.start();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const address = email.trim();
    setEmail(address);
    const problem = validateEmail(address, TEXT.empty);
    setError(problem);
    if (problem) {
      emailRef.current?.focus();
      return;
    }
    void send(address);
  }

  const retry = (
    <NetworkNotice text={TEXT.network} onRetry={() => void send(email)} />
  );

  if (view === "sent") {
    const noteId = "accesso-password-attesa";
    return (
      <AuthLayout
        back="/accesso/mail"
        intro={
          <Intro
            eyebrow="Password dimenticata"
            title="Ti abbiamo scritto"
            titleRef={titleRef}
          >
            Se <b className={styles.address}>{email}</b> è la mail di un account
            FamilyNest, ti è arrivato un link per scegliere una nuova password.
          </Intro>
        }
        body={<HintList rows={ROWS} />}
        actions={
          <>
            {failed ? retry : null}
            <Button
              variant="secondary"
              full
              loading={pending}
              disabled={cooldown.waiting && !pending}
              aria-describedby={cooldown.waiting ? noteId : undefined}
              onClick={() => void send(email)}
            >
              {pending ? TEXT.sending : "Mandami un altro link"}
            </Button>
            {cooldown.waiting ? (
              <p className="t-nota t-secondario" id={noteId}>
                {`Puoi chiederne un altro tra ${seconds(cooldown.secondsLeft)}.`}
              </p>
            ) : null}
            <div className="gruppo-chip">
              <Button
                variant="link"
                onClick={() => {
                  setView("form");
                  setFailed(false);
                  setError(null);
                }}
              >
                Usa un&apos;altra mail
              </Button>
              <ToAccessLink href="/accesso/mail" />
            </div>
          </>
        }
      />
    );
  }

  return (
    <AuthLayout
      back="/accesso/mail"
      intro={
        <Intro
          eyebrow="Accesso con la mail"
          title="Hai dimenticato la password?"
        >
          Scrivi la mail del tuo account: ti mandiamo un link per sceglierne una
          nuova.
        </Intro>
      }
      form={{
        id: "accesso-password-modulo",
        action: "/accesso/password-dimenticata/invio",
        onSubmit: handleSubmit,
      }}
      body={
        <>
          {failed ? retry : null}
          <MailField
            id="accesso-password-email"
            value={email}
            onChange={setEmail}
            error={error}
            inputRef={emailRef}
            readOnly={pending}
          />
        </>
      }
      actions={
        <>
          <Button variant="primary" type="submit" full loading={pending}>
            {pending ? TEXT.sending : "Mandami il link"}
          </Button>
          <ToAccessRow href="/accesso/mail" />
        </>
      }
    />
  );
}
