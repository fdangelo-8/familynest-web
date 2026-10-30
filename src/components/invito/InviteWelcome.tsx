"use client";

import { useEffect, useRef, useState } from "react";
import { Brand, LegalLine } from "@/components/accesso/parts";
import styles from "@/components/accesso/accesso.module.css";
import { Avatar } from "@/components/ui/Avatar/Avatar";
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
import { INVITE_COLOR_PATH } from "@/lib/invitations";
import {
  avatarGroupLabel,
  avatarItems,
  claimLead,
  oneLine,
  type PublicMember,
} from "./invite-text";

export type InviteWelcomeProps = {
  nestName: string;
  /** `null` when whoever invited has left the Nest */
  inviterName: string | null;
  message: string | null;
  inviteeName: string;
  /** Initial and colour of the others: no names reach this page (decision D-1) */
  members: PublicMember[];
  /** «Invito valido ancora 6 giorni.» */
  expiryLead: string;
  initialError: AccessError | null;
};

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
    // Back from the provider with an error: the screen reader reads it at once.
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

/** The people already in the Nest, only as circles: initial and colour. */
function AvatarGroup({
  inviterName,
  members,
}: {
  inviterName: string | null;
  members: PublicMember[];
}) {
  const label = avatarGroupLabel(inviterName, members.length);
  return (
    <span
      className="avatar-gruppo avatar-gruppo--grande avatar-gruppo--notte"
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      {avatarItems(members).map((item, index) =>
        item.kind === "member" ? (
          <Avatar
            key={index}
            name={item.initial}
            color={item.color}
            size="xl"
            nameShown
          />
        ) : (
          <span
            key={index}
            className="avatar avatar--xl avatar--altri"
            aria-hidden="true"
          >
            +{item.count}
          </span>
        ),
      )}
      <span className="avatar avatar--xl avatar--vuoto" aria-hidden="true">
        ?
      </span>
    </span>
  );
}

function ClaimText({
  inviterName,
  nestName,
}: {
  inviterName: string | null;
  nestName: string;
}) {
  return (
    <>
      {claimLead(inviterName)}
      <br />
      in <b>{nestName}</b>
    </>
  );
}

function Quote({
  inviterName,
  message,
}: {
  inviterName: string | null;
  message: string | null;
}) {
  if (!message || !inviterName) return null;
  return (
    <p className="citazione">
      <b>{inviterName}:</b> «{oneLine(message)}»
    </p>
  );
}

/**
 * Welcome page of an invitation (mockup 07, normal and loading states): two
 * layouts in one <main>, one visible at a time. Apple and Google start from
 * the browser and come back to the colour page; signing in does not make
 * anyone join the Nest, only «Continua» on the colour page does.
 */
export function InviteWelcome({
  nestName,
  inviterName,
  message,
  inviteeName,
  members,
  expiryLead,
  initialError,
}: InviteWelcomeProps) {
  const [error, setError] = useState<AccessError | null>(initialError);
  const [fromServer, setFromServer] = useState(initialError !== null);
  const [loading, setLoading] = useState<Provider | null>(null);
  const busy = useRef(false);

  // Back from the provider with the browser's button: no button stays loading.
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
    const result = await startOAuthSignIn(provider, {
      next: INVITE_COLOR_PATH,
    });
    // `started`: the browser is going to the provider, the loading state stays.
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

  function providerButton(provider: Provider, variant: "chiaro" | "secondary") {
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
          : `Entra con ${PROVIDER_NAME[provider]}`}
      </Button>
    );
  }

  const mailLink = (
    <div className="gruppo-chip">
      <Button variant="link" href="/accesso/mail" disabled={loading !== null}>
        Usa la mail
      </Button>
    </div>
  );

  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <div className="sezione">
          <AvatarGroup inviterName={inviterName} members={members} />
          <h1 className="t-display claim">
            <ClaimText inviterName={inviterName} nestName={nestName} />
          </h1>
          <Quote inviterName={inviterName} message={message} />
        </div>
        <div className="dialogo__azioni">
          {notice}
          {providerButton("apple", "chiaro")}
          {providerButton("google", "chiaro")}
          {mailLink}
          <LegalLine className="legale" lead={expiryLead} />
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <div className="sezione">
            <AvatarGroup inviterName={inviterName} members={members} />
            <p className="t-display claim">
              <ClaimText inviterName={inviterName} nestName={nestName} />
            </p>
            <Quote inviterName={inviterName} message={message} />
          </div>
          <span />
        </div>
        <div className="split-onboarding__passo">
          <span />
          <div className="sezione">
            <div className="intestazione">
              <p className="intestazione__sopra">Invito per {inviteeName}</p>
              <h1 className="intestazione__titolo t-titolo-pagina">
                Entra in {nestName}
              </h1>
            </div>
            {notice}
            <div className="dialogo__azioni">
              {providerButton("apple", "secondary")}
              {providerButton("google", "secondary")}
              {mailLink}
              <LegalLine className="t-nota t-secondario" lead={expiryLead} />
            </div>
          </div>
          <span />
        </div>
      </div>
    </main>
  );
}
