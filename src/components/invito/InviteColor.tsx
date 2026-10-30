"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { acceptInvitation } from "@/app/invito/actions";
import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Steps } from "@/components/onboarding/Steps";
import onboardingStyles from "@/components/onboarding/onboarding.module.css";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import {
  chosenFirstOrder,
  ColorChoice,
  type ChoosableColor,
  type TakenColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import { Icon } from "@/components/ui/Icon/Icon";
import { HOUSEHOLD_FULL_MESSAGE } from "@/lib/household-limits";
import { colorHelp, colorWithArticle } from "./invite-text";

export type InviteColorProps = {
  inviteeName: string;
  /** Colour the inviter gave: chosen at the start */
  inviteeColor: ChoosableColor;
  /** `null` when whoever invited has left the Nest */
  inviterName: string | null;
  /** Colours of the other members, with their names (only after signing in) */
  taken: TakenColor[];
};

type Notice =
  | { kind: "taken"; text: string }
  | { kind: "failure"; failure: "network" | "server" }
  | { kind: "full" };

const FAILURE_TEXT = {
  network:
    "Non siamo riusciti ad andare avanti. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti ad andare avanti per un problema nostro. Riprova tra qualche minuto.",
} as const;

const GROUP_ERROR = "Scegli un colore per continuare.";
const TAKEN_FALLBACK =
  "Qualcuno ha appena preso questo colore. Scegline un altro.";
const PREFIXES = ["m", "d"] as const;

/**
 * Colour page of an invitation (mockup 08): two layouts in one <main>, one
 * visible at a time, sharing one state. Choosing a colour writes nothing:
 * only «Continua» joins the Nest, in one server action.
 */
export function InviteColor({
  inviteeName,
  inviteeColor,
  inviterName,
  taken: initialTaken,
}: InviteColorProps) {
  const router = useRouter();
  const [taken, setTaken] = useState<TakenColor[]>(initialTaken);
  // Computed once when the page opens: the circles never move under the finger.
  const [order] = useState(() => chosenFirstOrder(inviteeColor, initialTaken));
  const [value, setValue] = useState<ChoosableColor | null>(inviteeColor);
  // Colour of the preview: stays on the last one shown when none is chosen.
  const [shown, setShown] = useState<ChoosableColor>(inviteeColor);
  const [groupError, setGroupError] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{
    ids: string[];
    n: number;
  } | null>(null);
  const busy = useRef(false);
  // The help names the colour the inviter gave: it does not change.
  const [help] = useState(() => colorHelp(inviterName, inviteeColor));

  useEffect(() => {
    if (!focusTarget) return;
    // One of the two layouts is hidden: focus() does nothing there.
    for (const id of focusTarget.ids) document.getElementById(id)?.focus();
  }, [focusTarget]);

  function focusColor(color: ChoosableColor | null) {
    if (!color) return;
    setFocusTarget({
      ids: PREFIXES.map((p) => `${p}-colore-${color}`),
      n: Date.now(),
    });
  }

  function firstFree(list: ReadonlyArray<TakenColor>): ChoosableColor | null {
    return order.find((c) => !list.some((t) => t.color === c)) ?? null;
  }

  function choose(color: ChoosableColor) {
    setValue(color);
    setShown(color);
    setGroupError(false);
    // The warning about the colour taken goes away with the next choice.
    setNotice((current) => (current?.kind === "taken" ? null : current));
  }

  async function submit() {
    if (busy.current) return;
    if (!value) {
      setGroupError(true);
      focusColor(firstFree(taken));
      return;
    }
    // A failure notice stays while «Riprova» works, so its button shows the spinner.
    setNotice((current) => (current?.kind === "failure" ? current : null));
    if (!navigator.onLine) {
      setNotice({ kind: "failure", failure: "network" });
      return;
    }
    busy.current = true;
    setSending(true);
    let result: Awaited<ReturnType<typeof acceptInvitation>> | null = null;
    try {
      result = await acceptInvitation(value);
    } catch {
      result = null;
    }
    if (result?.status === "go") {
      // Stays in loading until the page changes.
      router.replace(result.destination);
      return;
    }
    busy.current = false;
    setSending(false);
    if (!result) {
      setNotice({ kind: "failure", failure: "network" });
    } else if (result.status === "error") {
      setNotice({ kind: "failure", failure: result.kind });
    } else if (result.status === "full") {
      setNotice({ kind: "full" });
      setFocusTarget({
        ids: PREFIXES.map((p) => `${p}-colore-pieno`),
        n: Date.now(),
      });
    } else if (result.status === "taken") {
      const by = result.taken.find((t) => t.color === value)?.by;
      setTaken(result.taken);
      setNotice({
        kind: "taken",
        text: by
          ? `${by} ha appena preso ${colorWithArticle(value)}. Scegli un altro colore.`
          : TAKEN_FALLBACK,
      });
      // Back to the colour the inviter gave if it is free, otherwise none.
      const back = result.taken.some((t) => t.color === inviteeColor)
        ? null
        : inviteeColor;
      setValue(back);
      if (back) setShown(back);
      focusColor(back ?? firstFree(result.taken));
    }
  }

  const full = notice?.kind === "full";
  const alert = notice ? (
    notice.kind === "failure" ? (
      <Alert
        variant="errore"
        icon={notice.failure === "network" ? "wifi-off" : "circle-alert"}
        action={
          <Button
            variant="link"
            loading={sending}
            onClick={() => void submit()}
          >
            Riprova
          </Button>
        }
      >
        {FAILURE_TEXT[notice.failure]}
      </Alert>
    ) : (
      <Alert variant="errore" icon="circle-alert">
        {notice.kind === "full" ? HOUSEHOLD_FULL_MESSAGE : notice.text}
      </Alert>
    )
  ) : null;

  const card = (prefix: (typeof PREFIXES)[number]) => {
    const helpId = `${prefix}-colore-aiuto`;
    const errorId = `${prefix}-colore-errore`;
    return (
      <div className="scheda anteprima-avatar">
        <Avatar name={inviteeName} color={shown} size="xl" nameShown />
        <span className="anteprima-avatar__nome">{inviteeName}</span>
        <ColorChoice
          aria-label="Il tuo colore"
          value={value}
          onChange={choose}
          taken={taken}
          order={order}
          disabled={sending || full}
          invalid={groupError}
          describedBy={groupError ? `${errorId} ${helpId}` : helpId}
          idPrefix={`${prefix}-colore`}
        />
        {groupError ? (
          <p className="campo__errore" id={errorId}>
            <Icon name="circle-alert" size="s" />
            {GROUP_ERROR}
          </p>
        ) : null}
        <p className="campo__aiuto" id={helpId}>
          {help}
        </p>
      </div>
    );
  };

  const alertBox = (prefix: (typeof PREFIXES)[number]) =>
    alert ? (
      full ? (
        <div id={`${prefix}-colore-pieno`} tabIndex={-1}>
          {alert}
        </div>
      ) : (
        alert
      )
    ) : null;

  const heading = (
    <div className="intestazione">
      <p className="intestazione__sopra">Ciao {inviteeName}</p>
      <h1 className="intestazione__titolo t-titolo-pagina">
        Scegli il tuo colore
      </h1>
    </div>
  );

  return (
    <main className={onboardingStyles.root}>
      <div className={`${onboardingStyles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <Link
            href="/invito"
            prefetch={false}
            className="btn-icona"
            aria-label="Indietro"
            aria-disabled={sending || undefined}
            onClick={(event) => {
              if (sending) event.preventDefault();
            }}
          >
            <Icon name="arrow-left" />
          </Link>
          <Steps current={1} total={3} />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        {heading}
        <div className="sezione">
          {card("m")}
          {alertBox("m")}
        </div>
        <div className="dialogo__azioni">
          <Button
            full
            disabled={full}
            loading={sending}
            onClick={() => void submit()}
          >
            Continua
          </Button>
        </div>
      </div>

      <div className={`${onboardingStyles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <Steps current={1} total={3} />
          <div className="sezione">
            {heading}
            {card("d")}
            {alertBox("d")}
          </div>
          <div className="modale__piede">
            <span />
            <Button
              disabled={full}
              loading={sending}
              onClick={() => void submit()}
            >
              Continua
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
