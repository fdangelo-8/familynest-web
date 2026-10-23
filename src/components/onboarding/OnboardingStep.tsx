"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { createNest } from "@/app/onboarding/actions";
import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import { CHOICES, type Living } from "./choices";
import styles from "./onboarding.module.css";

type Failure = "network" | "server";

const FAILURE_TEXT: Record<Failure, string> = {
  network:
    "Non siamo riusciti a creare il tuo Nest. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a creare il tuo Nest per un problema nostro. Riprova tra qualche minuto.",
};

const SIGN_OUT_FORM = "onboarding-signout";

function ChoiceGroup({
  prefix,
  value,
  disabled,
  describedBy,
  onChoose,
}: {
  prefix: string;
  value: Living | null;
  disabled: boolean;
  describedBy: string | undefined;
  onChoose: (value: Living) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(index: number) {
    if (disabled) return;
    const choice = CHOICES[index];
    if (!choice) return;
    onChoose(choice.value);
    refs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = CHOICES.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      choose(index === last ? 0 : index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      choose(index === 0 ? last : index - 1);
    } else if (event.key === "Enter") {
      // Enter never chooses inside the group.
      event.preventDefault();
    }
  }

  const tabStop = value ? CHOICES.findIndex((c) => c.value === value) : 0;

  return (
    <div
      className="gruppo-scelte gruppo-scelte--due"
      role="radiogroup"
      aria-label="Chi vive con te?"
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
    >
      {CHOICES.map((choice, index) => {
        const titleId = `${prefix}-${choice.value}-titolo`;
        const infoId = `${prefix}-${choice.value}-info`;
        return (
          <button
            key={choice.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            className="scelta"
            role="radio"
            aria-checked={value === choice.value}
            aria-labelledby={titleId}
            aria-describedby={infoId}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => choose(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="cerchi-membri" aria-hidden="true">
              {choice.circles.map((circle, i) => (
                <span
                  key={i}
                  className={`cerchi-membri__cerchio${
                    circle.small ? " cerchi-membri__cerchio--piccolo" : ""
                  } membro-${circle.color}`}
                />
              ))}
            </span>
            <span>
              <span className="scelta__titolo" id={titleId}>
                {choice.title}
              </span>
              <span className="scelta__info" id={infoId}>
                {choice.info}
              </span>
            </span>
            <span className="scelta__radio" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function Steps() {
  return (
    <div
      className="tacche-passi"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={1}
      aria-label="Passo 1 di 4"
    >
      <span className="tacche-passi__tacca is-fatta" />
      <span className="tacche-passi__tacca" />
      <span className="tacche-passi__tacca" />
      <span className="tacche-passi__tacca" />
    </div>
  );
}

function Heading({ greeting }: { greeting: string }) {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">{greeting}</p>
      <h1 className="intestazione__titolo t-titolo-pagina">Chi vive con te?</h1>
    </div>
  );
}

/**
 * Step 1 of the onboarding (mockup 02): two layouts in one <main>, one visible
 * at a time, sharing one state. "Continua" creates the Nest on the server.
 */
export function OnboardingStep({ greeting }: { greeting: string }) {
  const [value, setValue] = useState<Living | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const busy = useRef(false);
  const router = useRouter();

  async function submit() {
    if (!value || busy.current) return;
    busy.current = true;
    setSending(true);
    setFailure(null);
    let result: Awaited<ReturnType<typeof createNest>> | null = null;
    try {
      result = await createNest(value);
    } catch {
      result = null;
    }
    if (result?.status === "ok") {
      // Stays in loading until the page changes.
      router.replace(result.destination);
      return;
    }
    busy.current = false;
    setSending(false);
    setFailure(result ? "server" : "network");
  }

  const help = (prefix: string) =>
    value ? null : (
      <p className="campo__aiuto" id={`${prefix}-aiuto`}>
        Scegli una risposta per continuare.
      </p>
    );
  const describedBy = (prefix: string) =>
    value ? undefined : `${prefix}-aiuto`;
  const notice = failure ? (
    <div className="avviso avviso--errore" role="alert">
      <Icon name={failure === "network" ? "wifi-off" : "circle-alert"} />
      <p className="avviso__testo">{FAILURE_TEXT[failure]}</p>
      <Button variant="link" onClick={() => void submit()}>
        Riprova
      </Button>
    </div>
  ) : null;

  return (
    <main className={styles.root}>
      {/* "Indietro" signs out of this device (POST), then goes to /accesso. */}
      <form id={SIGN_OUT_FORM} method="post" action="/auth/signout" />

      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <button
            type="submit"
            form={SIGN_OUT_FORM}
            className="btn-icona"
            aria-label="Indietro"
          >
            <Icon name="arrow-left" />
          </button>
          <Steps />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        <Heading greeting={greeting} />
        <div className="sezione">
          <ChoiceGroup
            prefix="m"
            value={value}
            disabled={sending}
            describedBy={describedBy("m")}
            onChoose={setValue}
          />
          {help("m")}
          {notice}
        </div>
        <div className="dialogo__azioni">
          <Button
            full
            disabled={!value}
            loading={sending}
            onClick={() => void submit()}
          >
            Continua
          </Button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <Steps />
          <div className="sezione">
            <Heading greeting={greeting} />
            <ChoiceGroup
              prefix="d"
              value={value}
              disabled={sending}
              describedBy={describedBy("d")}
              onChoose={setValue}
            />
            {help("d")}
            {notice}
          </div>
          <div className="modale__piede">
            <button
              type="submit"
              form={SIGN_OUT_FORM}
              className="btn-link btn-link--secondario"
            >
              Indietro
            </button>
            <Button
              disabled={!value}
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
