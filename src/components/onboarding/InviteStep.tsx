"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import styles from "./onboarding.module.css";
import { Steps } from "./Steps";

/** Where the step leads: kept in one place so later pages can change it. */
const INVITE_PATH = "/onboarding/invito";
const PREVIOUS_STEP = "/onboarding/persone";
const NEXT_STEP = "/onboarding/pronto";

/** Names longer than this make the buttons shorter, so they stay on one line. */
const LONG_NAME = 15;

export type InviteFailure = "network" | "server";

const FAILURE_TEXT = (name: string): Record<InviteFailure, string> => ({
  network: `Non riusciamo a preparare l'invito per ${name}. Controlla la connessione e riprova.`,
  server: `Non riusciamo a preparare l'invito per ${name} per un problema nostro. Riprova tra qualche minuto.`,
});

/** Address of the invitation of the adult at `position` (1 = first). */
function invitePath(position: number): string {
  return position <= 1 ? INVITE_PATH : `${INVITE_PATH}?persona=${position}`;
}

export type InviteProps = {
  /** Name of the adult shown */
  name: string;
  /** Position of the adult (1 = first) and how many adults to invite */
  position: number;
  total: number;
  /** Name of the next adult, null for the last one */
  nextName: string | null;
  /** Token of the valid invitation; null when it could not be prepared */
  token: string | null;
  failure: InviteFailure | null;
  /** Sentence under the title, already formatted */
  note: string;
};

/**
 * Step 4 of the onboarding (mockup 05, without the QR code): one adult at a
 * time. Two layouts in one <main>, one visible at a time, sharing one state.
 * The link is `<origin>/invito/<token>`; it is never shown as text.
 */
export function InviteStep({
  name,
  position,
  total,
  nextName,
  token,
  failure,
  note,
}: InviteProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [going, setGoing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const mobileHeading = useRef<HTMLHeadingElement>(null);
  const desktopHeading = useRef<HTMLHeadingElement>(null);
  const previous = useRef({ position, failed: failure !== null });

  const long = Array.from(name).length > LONG_NAME;
  const sendLabel = long ? "Manda il link" : `Manda il link a ${name}`;
  const nextLabel = long ? "Invita il prossimo" : `Ora invita ${nextName}`;
  const exitMobile = nextName ? nextLabel : "Lo faccio dopo";
  const exitDesktop = nextName ? nextLabel : "Ho finito";
  const above =
    total > 1
      ? `Ultimo passo · invito ${position} di ${total}`
      : "Ultimo passo";
  const backHref = position <= 1 ? PREVIOUS_STEP : invitePath(position - 1);
  const noLink = token === null || going;

  // New adult, or the invitation just got prepared: the heading takes the
  // focus so a screen reader reads "Invita <nome>".
  useEffect(() => {
    const before = previous.current;
    previous.current = { position, failed: failure !== null };
    const changed = before.position !== position;
    const recovered = before.failed && failure === null;
    if (changed || recovered) {
      setGoing(false);
      setRetrying(false);
      window.scrollTo(0, 0);
      for (const heading of [mobileHeading.current, desktopHeading.current]) {
        if (heading && heading.offsetParent !== null) {
          heading.focus();
          return;
        }
      }
    } else if (before.failed && failure !== null) {
      setRetrying(false);
    }
  }, [position, failure]);

  function link(): string {
    return `${window.location.origin}/invito/${token}`;
  }

  async function copy(): Promise<void> {
    if (token === null) return;
    try {
      await navigator.clipboard.writeText(link());
    } catch {
      setCopyFailed(true);
      return;
    }
    setCopyFailed(false);
    showToast({ text: `Link copiato. Mandalo a ${name} dove preferisci.` });
  }

  async function share(): Promise<void> {
    if (token === null) return;
    if (typeof navigator.share !== "function") {
      await copy();
      return;
    }
    try {
      await navigator.share({ url: link() });
      setCopyFailed(false);
    } catch (error) {
      // Closing the sheet is not an error: nothing to say.
      if (error instanceof Error && error.name === "AbortError") return;
      await copy();
    }
  }

  function exit() {
    if (going) return;
    setGoing(true);
    const href = nextName ? invitePath(position + 1) : NEXT_STEP;
    startTransition(() => router.push(href));
  }

  function retry() {
    if (retrying) return;
    setRetrying(true);
    startTransition(() => router.refresh());
  }

  const heading = (ref: typeof mobileHeading) => (
    <div className="intestazione">
      <p className="intestazione__sopra">{above}</p>
      <h1
        ref={ref}
        tabIndex={-1}
        className="intestazione__titolo t-titolo-pagina"
      >
        Invita {name}
      </h1>
    </div>
  );

  const body = failure ? (
    <Alert
      variant="errore"
      icon={failure === "network" ? "wifi-off" : "circle-alert"}
      action={
        <Button variant="link" loading={retrying} onClick={retry}>
          Riprova
        </Button>
      }
    >
      {FAILURE_TEXT(name)[failure]}
    </Alert>
  ) : (
    <p className="t-nota t-secondario">{note}</p>
  );

  const copyAlert = copyFailed ? (
    <Alert variant="errore">
      Non siamo riusciti a copiare il link. Riprova.
    </Alert>
  ) : null;

  const sendButton = (full: boolean) => (
    <Button
      icon="send"
      full={full}
      disabled={noLink}
      onClick={() => void share()}
    >
      {sendLabel}
    </Button>
  );
  const copyButton = (full: boolean) => (
    <Button
      variant="secondary"
      icon="copy"
      full={full}
      disabled={noLink}
      onClick={() => void copy()}
    >
      Copia il link
    </Button>
  );

  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <Link
            href={backHref}
            prefetch={false}
            className="btn-icona"
            aria-label="Indietro"
          >
            <Icon name="arrow-left" />
          </Link>
          <Steps current={4} total={4} />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        {heading(mobileHeading)}
        <div className="sezione">{body}</div>
        <div className="dialogo__azioni">
          {copyAlert}
          {sendButton(true)}
          {copyButton(true)}
          <button
            type="button"
            className="btn-link btn-link--secondario"
            aria-busy={going || undefined}
            aria-disabled={going || undefined}
            onClick={exit}
          >
            {exitMobile}
          </button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <Steps current={4} total={4} />
          <div className="sezione">
            {heading(desktopHeading)}
            {body}
            {copyAlert}
            <div className="campo-doppio">
              {sendButton(false)}
              {copyButton(false)}
            </div>
          </div>
          <div className="modale__piede">
            <Link
              href={backHref}
              prefetch={false}
              className="btn-link btn-link--secondario"
            >
              Indietro
            </Link>
            <Button loading={going} onClick={exit}>
              {exitDesktop}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
