"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { clearLinkResult } from "@/app/onboarding/calendario/actions";
import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import type { LinkResult } from "@/lib/calendar-sync/oauth";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import styles from "./onboarding.module.css";
import { Steps } from "./Steps";

type ProviderId = "google" | "outlook";

/** One provider row as the page needs it. Mail and counts are the adult's own. */
export type CalendarRow = {
  provider: ProviderId;
  name: string;
  /** Second line: what the provider is, or the account once linked */
  info: string;
  linked: boolean;
};

/** How the last link ended (the short cookie of #34 §10). */
export type CalendarNotice = {
  provider: ProviderId;
  result: LinkResult;
};

export type CalendarStepProps = {
  rows: CalendarRow[];
  steps: { current: number; total: number };
  /** Arrow «Indietro»; null for whoever joined with an invitation */
  backHref: string | null;
  /** Where «Continua» and «Più tardi» go, decided by the server */
  next: string;
  notice: CalendarNotice | null;
};

const NAMES: Record<ProviderId, string> = {
  google: "Google",
  outlook: "Outlook",
};

const ASSURANCES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "eye-off",
    title: "Gli altri vedono solo che sei occupato",
    text: "Mai il titolo né il luogo dei tuoi impegni di lavoro.",
  },
  {
    icon: "repeat",
    title: "In due direzioni",
    text: "Quello che aggiungi qui può andare anche lì, e viceversa.",
  },
  {
    icon: "sliders-horizontal",
    title: "Scegli dopo cosa tenere",
    text: "Da Impostazioni › Calendari collegati.",
  },
];

/** The account is there: the row says «Collegato», no notice is needed. */
function isLinked(notice: CalendarNotice): boolean {
  return notice.result === "linked" || notice.result === "already_linked";
}

function noticeText(notice: CalendarNotice): string {
  const name = NAMES[notice.provider];
  if (notice.result === "no_calendar_permission") {
    return `${name} ci ha dato l'accesso all'account ma non al calendario. Riprova e lascia la spunta su «Calendario».`;
  }
  if (notice.result === "admin_approval") {
    return `Il tuo account di lavoro non permette di collegare app esterne a ${name}. Chiedi a chi gestisce gli account in ufficio di approvare FamilyNest, oppure collega un altro calendario.`;
  }
  return `Non siamo riusciti a collegare ${name}. Riprova o salta questo passo.`;
}

const OFFLINE_TEXT =
  "Sei offline: per collegare un calendario serve la connessione. Puoi saltare questo passo e farlo dopo.";

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** The «Collega» form posts to the route of #34 §10; the server answers 303. */
function ConnectForm({
  provider,
  onSubmit,
  children,
}: {
  provider: ProviderId;
  onSubmit: (provider: ProviderId) => void;
  children: ReactNode;
}) {
  return (
    <form
      method="post"
      action={`/calendari-collegati/collega/${provider}`}
      onSubmit={() => onSubmit(provider)}
    >
      <input type="hidden" name="destination" value="onboarding" />
      {children}
    </form>
  );
}

function Providers({
  rows,
  connecting,
  offline,
  onConnect,
}: {
  rows: CalendarRow[];
  connecting: ProviderId | null;
  offline: boolean;
  onConnect: (provider: ProviderId) => void;
}) {
  return (
    <ul className="scheda lista" aria-label="Calendari da collegare">
      {rows.map((row) => (
        <li key={row.provider} className="riga-lista">
          <span
            className={`logo-marchio logo-marchio--${row.provider}`}
            aria-hidden="true"
          >
            {row.name.slice(0, 1)}
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{row.name}</span>
            <span className="riga-lista__info">{row.info}</span>
          </span>
          {row.linked ? (
            <span className="etichetta etichetta--scura">
              <Icon name="check" size="s" />
              Collegato
            </span>
          ) : (
            // The form stays in the page while the button turns into the
            // spinner: removing it during the submit would cancel the post.
            <ConnectForm provider={row.provider} onSubmit={onConnect}>
              {connecting === row.provider ? (
                <span className="btn-tenue" aria-busy="true">
                  <Spinner />
                  Collegamento
                </span>
              ) : (
                <Button variant="tenue" type="submit" disabled={offline}>
                  Collega <VisuallyHidden>{row.name}</VisuallyHidden>
                </Button>
              )}
            </ConnectForm>
          )}
        </li>
      ))}
    </ul>
  );
}

function Assurances() {
  return (
    <ul className="scheda lista">
      {ASSURANCES.map((item) => (
        <li key={item.title} className="riga-lista">
          <span className="icona-riquadro">
            <Icon name={item.icon} />
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{item.title}</span>
            <span className="riga-lista__info">{item.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Notice({
  notice,
  offline,
  onConnect,
  onRetryOffline,
}: {
  notice: CalendarNotice | null;
  offline: boolean;
  onConnect: (provider: ProviderId) => void;
  onRetryOffline: () => void;
}) {
  if (offline) {
    return (
      <Alert
        variant="errore"
        icon="wifi-off"
        action={
          <Button variant="link" onClick={onRetryOffline}>
            Riprova
          </Button>
        }
      >
        {OFFLINE_TEXT}
      </Alert>
    );
  }
  if (!notice || isLinked(notice)) return null;
  return (
    <Alert
      variant="errore"
      icon={
        notice.result === "no_calendar_permission" ? "circle-alert" : "wifi-off"
      }
      action={
        <ConnectForm provider={notice.provider} onSubmit={onConnect}>
          <Button variant="link" type="submit">
            Riprova
          </Button>
        </ConnectForm>
      }
    >
      {noticeText(notice)}
    </Alert>
  );
}

function Heading() {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">Le tue giornate</p>
      <h1 className="intestazione__titolo t-titolo-pagina">
        Porta qui il tuo calendario
      </h1>
    </div>
  );
}

/**
 * Step 3 of the onboarding (mockup 04): link Outlook or Google, or skip. Two
 * layouts in one <main>, one visible at a time, sharing one state. The link
 * itself is a plain form post to the route of #34 §10 and a full page trip to
 * the provider, so nothing here ever sees a code or a token.
 */
export function CalendarStep({
  rows,
  steps,
  backHref,
  next,
  notice: initialNotice,
}: CalendarStepProps) {
  const router = useRouter();
  // The result cookie is deleted after the first read; the notice stays here.
  const [notice] = useState(initialNotice);
  const [connecting, setConnecting] = useState<ProviderId | null>(null);
  const [going, setGoing] = useState(false);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const offline = !online;
  const mobileActions = useRef<HTMLDivElement>(null);
  const desktopActions = useRef<HTMLDivElement>(null);

  const linked = rows.some((row) => row.linked);
  const main = linked ? "Continua" : "Continua senza calendario";
  const busy = connecting !== null;

  // Back from the provider: the cookie has done its job, and after a linked
  // account the focus goes to the main button so the keyboard moves on.
  useEffect(() => {
    if (initialNotice === null) return;
    void clearLinkResult();
    if (!isLinked(initialNotice)) return;
    for (const box of [mobileActions.current, desktopActions.current]) {
      const button = box?.querySelector("button");
      if (button && button.offsetParent !== null) {
        button.focus();
        return;
      }
    }
  }, [initialNotice]);

  // Coming back with the browser button: the page may be restored as it was.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setConnecting(null);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  // The notice and the forms stay: the page leaves for the provider anyway,
  // and unmounting a form during its submit would cancel the post.
  function connect(provider: ProviderId) {
    setConnecting(provider);
  }

  function goOn() {
    if (going || busy) return;
    setGoing(true);
    startTransition(() => router.push(next));
  }

  const later = (
    <Link
      href={next}
      prefetch={false}
      className="btn-link btn-link--secondario"
      aria-disabled={going || undefined}
    >
      Più tardi
    </Link>
  );

  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          {backHref ? (
            <Link
              href={backHref}
              prefetch={false}
              className="btn-icona"
              aria-label="Indietro"
            >
              <Icon name="arrow-left" />
            </Link>
          ) : (
            <span className="barra__vuoto" aria-hidden="true" />
          )}
          <Steps current={steps.current} total={steps.total} />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        <Heading />
        <div className="sezione">
          <Providers
            rows={rows}
            connecting={connecting}
            offline={offline}
            onConnect={connect}
          />
          <Notice
            notice={notice}
            offline={offline}
            onConnect={connect}
            onRetryOffline={() => router.refresh()}
          />
          <Assurances />
        </div>
        <div className="dialogo__azioni" ref={mobileActions}>
          <Button full disabled={busy} loading={going} onClick={goOn}>
            {main}
          </Button>
          {later}
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <Steps current={steps.current} total={steps.total} />
          <div className="sezione">
            <Heading />
            <Providers
              rows={rows}
              connecting={connecting}
              offline={offline}
              onConnect={connect}
            />
            <Notice
              notice={notice}
              offline={offline}
              onConnect={connect}
              onRetryOffline={() => router.refresh()}
            />
            <Assurances />
          </div>
          <div className="modale__piede" ref={desktopActions}>
            {later}
            <Button disabled={busy} loading={going} onClick={goOn}>
              {main}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
