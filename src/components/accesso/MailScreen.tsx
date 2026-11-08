"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { PasswordField } from "@/components/ui/PasswordField/PasswordField";
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout, Intro, ToAccessLink, ToAccessRow } from "./AuthLayout";
import {
  PASSWORD_TEXT,
  callbackUrl,
  isRateLimit,
  seconds,
  validateEmail,
  validateNewPassword,
} from "./fields";
import { MailField } from "./MailField";
import { HintList, LimitNotice, NetworkNotice, type HintRow } from "./notices";
import styles from "./accesso.module.css";
import { LegalLine } from "./parts";
import { useCooldown } from "./useCooldown";

type Mode = "login" | "register";
type Action = Mode | "resend";
type Outcome =
  | "entered"
  | "ok"
  | "limit"
  | "network"
  | "weak"
  | "credentials"
  | "unconfirmed";
type Context = "login" | "register" | "resend";
type Notice =
  | { kind: "credentials" }
  | { kind: "unconfirmed" }
  | { kind: "limit"; context: Context }
  | { kind: "network"; context: Context };

const TEXT = {
  emptyMail: {
    login: "Scrivi la tua mail per entrare.",
    register: "Scrivi la tua mail per registrarti.",
  },
  emptyPassword: {
    login: "Scrivi la password per entrare.",
    register: "Scegli una password per registrarti.",
  },
  limit: {
    login: "Troppi tentativi di fila. Aspetta qualche minuto e riprova.",
    register:
      "Ti abbiamo appena mandato una mail. Cercala nella posta, oppure riprova tra un minuto.",
    resend: "La mail di prima è appena partita. Puoi rimandarla tra un minuto.",
  },
  network: {
    login:
      "Non siamo riusciti a farti entrare. Controlla la connessione e riprova.",
    register:
      "Non siamo riusciti a creare l'account. Controlla la connessione e riprova.",
    resend:
      "Non siamo riusciti a mandare la mail. Controlla la connessione e riprova.",
  },
  credentials:
    "La mail e la password non corrispondono. Se finora entravi con il link nella mail, la password non ce l'hai ancora: scegline una.",
  unconfirmed:
    "Questa mail non è ancora confermata. Apri la mail «Conferma il tuo indirizzo» che ti abbiamo mandato, oppure fattene mandare un'altra.",
  resent: "Mail rimandata: usa quella più recente.",
} as const;

const MODES = [
  { value: "login", label: "Entra" },
  { value: "register", label: "Registrati" },
] as const;

const SENT_ROWS: ReadonlyArray<HintRow> = [
  { icon: "clock", title: "Vale un'ora", info: "E funziona una volta sola." },
  {
    icon: "search",
    title: "Non la trovi?",
    info: "Guarda nella posta indesiderata o nelle promozioni.",
  },
  {
    icon: "key-round",
    title: "Hai già un account con questa mail?",
    info: "Allora non ti arriva niente: entra con la tua password.",
  },
];

const INVITE_ROW: HintRow = {
  icon: "users",
  title: "Apri il link su questo dispositivo",
  info: "Così entri subito nel Nest che ti ha invitato.",
};

/** Calls Supabase for one action and says how it went (never throws). */
async function request(
  action: Action,
  email: string,
  password: string,
): Promise<Outcome> {
  try {
    const supabase = createClient();
    if (action === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) return "entered";
      if (error.code === "invalid_credentials") return "credentials";
      if (error.code === "email_not_confirmed") return "unconfirmed";
      return isRateLimit(error) ? "limit" : "network";
    }
    if (action === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // #326: without it Supabase falls back on the Site URL.
        options: { emailRedirectTo: callbackUrl("conferma") },
      });
      if (!error) return data.session ? "entered" : "ok";
      if (error.code === "weak_password") return "weak";
      // A mail already registered looks like a new one (no enumeration, D2).
      if (error.code === "user_already_exists") return "ok";
      return isRateLimit(error) ? "limit" : "network";
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl("conferma") },
    });
    if (!error) return "ok";
    return isRateLimit(error) ? "limit" : "network";
  } catch {
    return "network";
  }
}

/**
 * `/accesso/mail`: «Entra» and «Registrati» in one page, then «Controlla la
 * posta». Mail and password live only in this component's memory: never in the
 * URL, never stored, so a reload starts again from an empty form (#327).
 * `hasInvite` only tells that the invitation cookie is there (the token never
 * reaches the page).
 */
export function MailScreen({ hasInvite }: { hasInvite: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const cooldown = useCooldown();

  const [view, setView] = useState<"form" | "sent">("form");
  const [mode, setMode] = useState<Mode>("login");
  const [sentFrom, setSentFrom] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string | null;
    password?: string | null;
  }>({});
  const [pending, setPending] = useState<"form" | "resend" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const busy = useRef(false);
  const last = useRef<{ action: Action; email: string; password: string }>({
    action: "login",
    email: "",
    password: "",
  });
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Focus: «Controlla la posta» -> the title; the form -> the field, only from 1024 px.
  useEffect(() => {
    if (view === "sent") {
      titleRef.current?.focus();
    } else if (window.matchMedia("(min-width: 1024px)").matches) {
      emailRef.current?.focus();
    }
  }, [view]);

  function focusPasswordSoon() {
    window.requestAnimationFrame(() => passwordRef.current?.focus());
  }

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setPassword("");
    setShown(false);
    setErrors({});
    setNotice(null);
  }

  async function execute(action: Action, address: string, secret: string) {
    if (busy.current) return;
    busy.current = true;
    last.current = { action, email: address, password: secret };
    setPending(action === "resend" ? "resend" : "form");
    // «Rimanda la mail» from the notice keeps the notice (and its button, in
    // loading) on screen while the request runs, so the focus stays on it.
    const fromNotice = action === "resend" && notice?.kind === "unconfirmed";
    if (!fromNotice) setNotice(null);
    const outcome = await request(action, address, secret);
    busy.current = false;
    // The password is only needed again for «Riprova» after a network error.
    if (outcome !== "network") {
      last.current = { ...last.current, password: "" };
    }

    if (outcome === "entered") {
      // The page for a signed-in person sends them to their destination
      // (Nest, invitation or onboarding). The button stays in loading.
      router.replace("/accesso/mail");
      return;
    }
    setPending(null);

    const context: Context = action;
    if (fromNotice) {
      // The button that had the focus goes away with the old notice.
      if (outcome === "ok") setNotice(null);
      else emailRef.current?.focus();
    }
    switch (outcome) {
      case "ok":
        if (action === "resend" && view === "sent") {
          showToast({ text: TEXT.resent, withoutNav: true });
        } else {
          if (action !== "resend") setSentFrom(action);
          else setSentFrom("login");
          setPassword("");
          setShown(false);
          setView("sent");
        }
        cooldown.start();
        break;
      case "limit":
        setNotice({ kind: "limit", context });
        if (action === "resend") cooldown.start();
        break;
      case "weak":
        setErrors({ password: PASSWORD_TEXT.weak });
        focusPasswordSoon();
        break;
      case "credentials":
        setPassword("");
        setShown(false);
        setNotice({ kind: "credentials" });
        focusPasswordSoon();
        break;
      case "unconfirmed":
        setNotice({ kind: "unconfirmed" });
        break;
      default:
        setNotice({ kind: "network", context });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const address = email.trim();
    setEmail(address);
    setShown(false);
    const problems = {
      email: validateEmail(address, TEXT.emptyMail[mode]),
      password:
        mode === "login"
          ? password
            ? null
            : TEXT.emptyPassword.login
          : validateNewPassword(password, TEXT.emptyPassword.register),
    };
    setErrors(problems);
    if (problems.email) {
      emailRef.current?.focus();
      return;
    }
    if (problems.password) {
      passwordRef.current?.focus();
      return;
    }
    void execute(mode, address, password);
  }

  function retry() {
    const { action, email: address, password: secret } = last.current;
    void execute(action, address, secret);
  }

  function chooseMode(next: Mode) {
    setView("form");
    setMode(next);
    setNotice(null);
    setErrors({});
  }

  const submitting = pending === "form";
  const resending = pending === "resend";

  // ---------------------------------------------------------------- notices
  function renderNotice() {
    if (!notice) return null;
    switch (notice.kind) {
      case "credentials":
        return (
          <Alert
            variant="errore"
            role="alert"
            action={
              <Button variant="link" href="/accesso/password-dimenticata">
                Scegli una password
              </Button>
            }
          >
            {TEXT.credentials}
          </Alert>
        );
      case "unconfirmed":
        return (
          <Alert
            variant="info"
            role="status"
            icon="info"
            action={
              <Button
                variant="link"
                loading={resending}
                onClick={() => void execute("resend", email.trim(), "")}
              >
                Rimanda la mail
              </Button>
            }
          >
            {TEXT.unconfirmed}
          </Alert>
        );
      case "limit":
        return <LimitNotice text={TEXT.limit[notice.context]} />;
      case "network":
        return (
          <NetworkNotice text={TEXT.network[notice.context]} onRetry={retry} />
        );
    }
  }

  // ------------------------------------------------------ Controlla la posta
  if (view === "sent") {
    const rows = hasInvite ? [...SENT_ROWS, INVITE_ROW] : SENT_ROWS;
    const noteId = "accesso-mail-attesa";
    return (
      <AuthLayout
        back="/accesso"
        intro={
          <Intro
            eyebrow={
              sentFrom === "register" ? "Registrazione" : "Accesso con la mail"
            }
            title="Controlla la posta"
            titleRef={titleRef}
          >
            Se è un indirizzo nuovo, ti abbiamo mandato una mail a{" "}
            <b className={styles.address}>{email}</b>. Aprila e tocca «Conferma
            l&apos;indirizzo»: entri subito in FamilyNest.
          </Intro>
        }
        body={<HintList rows={rows} />}
        actions={
          <>
            {renderNotice()}
            <Button
              variant="secondary"
              full
              loading={resending}
              disabled={cooldown.waiting && !resending}
              aria-describedby={cooldown.waiting ? noteId : undefined}
              onClick={() => void execute("resend", email, "")}
            >
              {resending ? "Invio della mail in corso" : "Rimanda la mail"}
            </Button>
            {cooldown.waiting ? (
              <p className="t-nota t-secondario" id={noteId}>
                {`Puoi rimandarla tra ${seconds(cooldown.secondsLeft)}.`}
              </p>
            ) : null}
            <div className="gruppo-chip">
              <Button variant="link" onClick={() => chooseMode("register")}>
                Usa un&apos;altra mail
              </Button>
              <Button variant="link" onClick={() => chooseMode("login")}>
                Entra con la password
              </Button>
              <ToAccessLink />
            </div>
          </>
        }
      />
    );
  }

  // ------------------------------------------------------- Entra / Registrati
  const login = mode === "login";
  return (
    <AuthLayout
      back="/accesso"
      intro={
        <Intro
          eyebrow="Accesso con la mail"
          title={login ? "Entra con la mail" : "Crea il tuo account"}
        >
          {login
            ? "Scrivi la mail e la password del tuo account."
            : "Poi ti mandiamo una mail per confermare l'indirizzo."}
        </Intro>
      }
      form={{
        id: "accesso-mail-modulo",
        action: "/accesso/mail/invio",
        onSubmit: handleSubmit,
      }}
      body={
        <>
          <SegmentedControl
            aria-label="Hai già un account?"
            options={MODES}
            value={mode}
            onChange={changeMode}
          />
          {renderNotice()}
          <MailField
            id="accesso-mail-email"
            value={email}
            onChange={setEmail}
            error={errors.email}
            inputRef={emailRef}
            readOnly={submitting}
          />
          <PasswordField
            id="accesso-mail-password"
            label={login ? "Password" : "Scegli una password"}
            autoComplete={login ? "current-password" : "new-password"}
            rules={!login}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password ?? undefined}
            inputRef={passwordRef}
            readOnly={submitting}
            shown={shown}
            onShownChange={setShown}
          />
          {login ? (
            <div className="gruppo-chip">
              <Button variant="link" href="/accesso/password-dimenticata">
                Password dimenticata?
              </Button>
            </div>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="primary" type="submit" full loading={submitting}>
            {submitting
              ? login
                ? "Accesso in corso"
                : "Creazione dell'account in corso"
              : login
                ? "Entra"
                : "Crea l'account"}
          </Button>
          <ToAccessRow />
        </>
      }
      legal={<LegalLine className="t-nota t-secondario" />}
    />
  );
}
