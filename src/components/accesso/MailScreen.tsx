"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { List, ListRow } from "@/components/ui/List/List";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import styles from "./accesso.module.css";
import { BackLink, Brand, Claim, LegalLine, Stickers } from "./parts";

// How long before a new link can be asked (Supabase limit).
const WAIT_MS = 60_000;
const MAX_EMAIL_LENGTH = 254;

const TEXT = {
  empty: "Scrivi la tua mail per ricevere il link.",
  invalid: "Controlla la mail: dovrebbe essere come nome@esempio.it.",
  network:
    "Non siamo riusciti a mandare il link. Controlla la connessione e riprova.",
  rateForm:
    "Hai appena chiesto un link per questa mail. Cercalo nella posta, oppure chiedine un altro tra un minuto.",
  rateResend:
    "Il link di prima è appena partito. Puoi chiederne un altro tra un minuto.",
  sending: "Invio del link in corso",
  resent: "Nuovo link mandato: usa quello più recente.",
} as const;

/** Trimmed address in, error text out (null = valid). */
function validateEmail(value: string): string | null {
  if (!value) return TEXT.empty;
  if (value.length > MAX_EMAIL_LENGTH) return TEXT.invalid;
  if (/\s/.test(value)) return TEXT.invalid;
  const parts = value.split("@");
  if (parts.length !== 2) return TEXT.invalid;
  const [local, domain] = parts as [string, string];
  if (local.length < 1) return TEXT.invalid;
  if (domain.indexOf(".") < 1 || domain.endsWith(".")) return TEXT.invalid;
  return null;
}

function waitText(seconds: number): string {
  return `Puoi chiederne un altro tra ${seconds} ${seconds === 1 ? "secondo" : "secondi"}.`;
}

function isVisible(el: HTMLElement | null): el is HTMLElement {
  return el !== null && el.offsetParent !== null;
}

type SendMode = "first" | "resend";
type SendResult = "ok" | "rate" | "network";
type Notice = "network" | "rate" | null;

async function requestLink(address: string): Promise<SendResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      // A mail never seen creates the account at the first click on the link.
      options: { shouldCreateUser: true },
    });
    if (!error) return "ok";
    if (
      error.status === 429 ||
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit"
    ) {
      return "rate";
    }
    return "network";
  } catch {
    return "network";
  }
}

/** Button that can sit outside its form (`form` attribute) and shows the loading state. */
function ActionButton({
  variant,
  loading,
  disabled,
  form,
  describedBy,
  onClick,
  children,
}: {
  variant: "primary" | "secondary";
  loading: boolean;
  disabled?: boolean;
  /** Submit button of the form with this id; without it, a plain button */
  form?: string;
  describedBy?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type={form ? "submit" : "button"}
      form={form}
      className={cx(
        variant === "primary" ? "btn-primary" : "btn-secondary",
        "btn--pieno",
        loading && "is-caricamento",
      )}
      disabled={disabled && !loading}
      aria-busy={loading || undefined}
      aria-describedby={describedBy}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.();
      }}
    >
      {loading ? <Spinner /> : null}
      <span className="btn__testo">{loading ? TEXT.sending : children}</span>
    </button>
  );
}

function NoticeBox({
  kind,
  text,
  onRetry,
}: {
  kind: "network" | "rate";
  text: string;
  onRetry?: () => void;
}) {
  if (kind === "network") {
    return (
      <div className="avviso avviso--errore" role="alert">
        <Icon name="wifi-off" />
        <p className="avviso__testo">{text}</p>
        <Button variant="link" onClick={onRetry}>
          Riprova
        </Button>
      </div>
    );
  }
  return (
    <div className="avviso avviso--info avviso--senza-azione" role="status">
      <Icon name="clock" />
      <p className="avviso__testo">{text}</p>
    </div>
  );
}

const WAIT_ROWS: ReadonlyArray<{
  icon: IconName;
  title: string;
  info: string;
}> = [
  { icon: "clock", title: "Vale un'ora", info: "E funziona una volta sola." },
  {
    icon: "search",
    title: "Non la trovi?",
    info: "Guarda nella posta indesiderata o nelle promozioni.",
  },
];

/**
 * `/accesso/mail`: M1 (the address) and M2 ("Controlla la posta") on the same
 * page. The address lives only in this component's memory: never in the URL,
 * never stored, so a reload starts again from an empty field.
 */
export function MailScreen() {
  const { showToast } = useToast();
  const base = useId();

  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  const busy = useRef(false);
  const lastAddress = useRef("");

  const mobileInput = useRef<HTMLInputElement>(null);
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileTitle = useRef<HTMLHeadingElement>(null);
  const desktopTitle = useRef<HTMLHeadingElement>(null);

  function focusFirst(...refs: RefObject<HTMLElement | null>[]) {
    for (const ref of refs) {
      if (isVisible(ref.current)) {
        ref.current.focus();
        return;
      }
    }
  }

  // Focus: M2 -> the heading; M1 -> the field, only from 1024 px.
  useEffect(() => {
    if (sentEmail !== null) {
      focusFirst(mobileTitle, desktopTitle);
    } else if (window.matchMedia("(min-width: 1024px)").matches) {
      focusFirst(desktopInput);
    }
  }, [sentEmail]);

  // Countdown of the wait before a new link (no live region: one update per
  // second would be read aloud).
  useEffect(() => {
    if (sentEmail === null || until === 0) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sentEmail, until]);

  function startWait() {
    const t = Date.now();
    setNow(t);
    setUntil(t + WAIT_MS);
  }

  async function send(address: string, mode: SendMode) {
    if (busy.current) return;
    busy.current = true;
    lastAddress.current = address;
    setSending(true);
    setNotice(null);
    const result = await requestLink(address);
    busy.current = false;
    setSending(false);

    if (result === "ok") {
      setSentEmail(address);
      startWait();
      if (mode === "resend") {
        showToast({ text: TEXT.resent, withoutNav: true });
      }
    } else if (result === "rate") {
      if (mode === "resend") startWait();
      setNotice("rate");
    } else {
      setNotice("network");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const address = email.trim();
    setEmail(address);
    const problem = validateEmail(address);
    setFieldError(problem);
    if (problem) {
      focusFirst(mobileInput, desktopInput);
      return;
    }
    void send(address, "first");
  }

  function chooseAnotherMail() {
    setSentEmail(null);
    setNotice(null);
    setFieldError(null);
  }

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));
  const waiting = secondsLeft > 0;

  const formId = (suffix: string) => `${base}-form-${suffix}`;
  const noteId = (suffix: string) => `${base}-attesa-${suffix}`;

  function renderField(
    suffix: string,
    inputRef: RefObject<HTMLInputElement | null>,
  ) {
    const inputId = `${base}-mail-${suffix}`;
    const errorId = `${base}-errore-${suffix}`;
    return (
      <div className={cx("campo", fieldError && "campo--errore")}>
        <label className="campo__etichetta" htmlFor={inputId}>
          La tua mail
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="campo__input"
          type="email"
          // No `name`: a native submit before hydration must not put the address in the URL.
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nome@esempio.it"
          value={email}
          readOnly={sending}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? errorId : undefined}
        />
        {fieldError ? (
          <p className="campo__errore" id={errorId}>
            <Icon name="circle-alert" size="s" />
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  }

  const formNotice =
    notice === "network" ? (
      <NoticeBox
        kind="network"
        text={TEXT.network}
        onRetry={() => void send(lastAddress.current, "first")}
      />
    ) : notice === "rate" ? (
      <NoticeBox kind="rate" text={TEXT.rateForm} />
    ) : null;

  const resendNotice =
    notice === "network" ? (
      <NoticeBox
        kind="network"
        text={TEXT.network}
        onRetry={() => void send(sentEmail ?? "", "resend")}
      />
    ) : notice === "rate" ? (
      <NoticeBox kind="rate" text={TEXT.rateResend} />
    ) : null;

  const formIntro = (
    <div className="intestazione">
      <p className="intestazione__sopra">Accesso con la mail</p>
      <h1 className="intestazione__titolo t-titolo-pagina">
        Qual è la tua mail?
      </h1>
      <p className="intestazione__sotto">
        Ti mandiamo un link: lo apri e sei dentro, senza password.
      </p>
    </div>
  );

  function renderSentIntro(titleRef: RefObject<HTMLHeadingElement | null>) {
    return (
      <div className="intestazione">
        <p className="intestazione__sopra">Accesso con la mail</p>
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="intestazione__titolo t-titolo-pagina"
        >
          Controlla la posta
        </h1>
        <p className="intestazione__sotto">
          Ti abbiamo mandato un link a{" "}
          <b className={styles.address}>{sentEmail}</b>. Apri la mail e tocca
          «Entra in FamilyNest».
        </p>
      </div>
    );
  }

  const hints = (
    <List className="scheda">
      {WAIT_ROWS.map((row) => (
        <ListRow key={row.title}>
          <span className="icona-riquadro">
            <Icon name={row.icon} />
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{row.title}</span>
            <span className="riga-lista__info">{row.info}</span>
          </span>
        </ListRow>
      ))}
    </List>
  );

  function renderResend(suffix: string) {
    return (
      <>
        {resendNotice}
        <ActionButton
          variant="secondary"
          loading={sending}
          disabled={waiting}
          describedBy={waiting ? noteId(suffix) : undefined}
          onClick={() => void send(sentEmail ?? "", "resend")}
        >
          Mandami un altro link
        </ActionButton>
        {waiting ? (
          <p className="t-nota t-secondario" id={noteId(suffix)}>
            {waitText(secondsLeft)}
          </p>
        ) : null}
      </>
    );
  }

  const otherMailButton = (
    <button type="button" className="btn-link" onClick={chooseAnotherMail}>
      Usa un&apos;altra mail
    </button>
  );

  const leftPanel = (
    <div className="split-onboarding__notte">
      <Brand />
      <Stickers />
      <Claim as="p" />
    </div>
  );

  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <BackLink />
          <span aria-hidden="true" />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        {sentEmail === null ? (
          <>
            {formIntro}
            <form
              method="post"
              id={formId("m")}
              className="sezione"
              noValidate
              onSubmit={handleSubmit}
            >
              {formNotice}
              {renderField("m", mobileInput)}
            </form>
            <div className="dialogo__azioni">
              <ActionButton
                variant="primary"
                loading={sending}
                form={formId("m")}
              >
                Mandami il link
              </ActionButton>
              <LegalLine className="t-nota t-secondario" />
            </div>
          </>
        ) : (
          <>
            {renderSentIntro(mobileTitle)}
            <div className="sezione">{hints}</div>
            <div className="dialogo__azioni">
              {renderResend("m")}
              <div className="gruppo-chip">{otherMailButton}</div>
            </div>
          </>
        )}
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        {leftPanel}
        <div className="split-onboarding__passo">
          <span />
          {sentEmail === null ? (
            <>
              <div className="sezione">
                {formIntro}
                {formNotice}
                <form
                  method="post"
                  id={formId("d")}
                  className="sezione"
                  noValidate
                  onSubmit={handleSubmit}
                >
                  {renderField("d", desktopInput)}
                </form>
                <div className="dialogo__azioni">
                  <ActionButton
                    variant="primary"
                    loading={sending}
                    form={formId("d")}
                  >
                    Mandami il link
                  </ActionButton>
                  <div className="gruppo-chip">
                    <Button variant="link" href="/accesso">
                      Torna all&apos;accesso
                    </Button>
                  </div>
                </div>
              </div>
              <LegalLine className="t-nota t-secondario" />
            </>
          ) : (
            <>
              <div className="sezione">
                {renderSentIntro(desktopTitle)}
                {hints}
                <div className="dialogo__azioni">
                  {renderResend("d")}
                  <div className="gruppo-chip">
                    {otherMailButton}
                    <Button variant="link" href="/accesso">
                      Torna all&apos;accesso
                    </Button>
                  </div>
                </div>
              </div>
              <span />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
