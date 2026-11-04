"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { BarAction } from "@/components/ui/AppFrame/BarAction";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { getPinLabel } from "@/lib/pin-texts";
import {
  addSpaceInterest,
  getSpaceInterests,
  removeSpaceInterest,
} from "@/lib/space-interests";
import {
  getSpacePromise,
  SPACES,
  type SpaceDef,
  type SpaceKey,
} from "@/lib/spaces";
import { createClient } from "@/lib/supabase/client";
import { useSpaces } from "./useSpaces";

const INTEREST_BUTTON = "space-interest";

type InterestState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; on: boolean };

async function readInterest(key: SpaceKey): Promise<InterestState> {
  try {
    const result = await getSpaceInterests(createClient());
    if (result.error) return { status: "error" };
    return { status: "ready", on: result.spaces.includes(key) };
  } catch {
    return { status: "error" };
  }
}

/** Esplora · «In arrivo»: what a space promises, «Avvisami» and the puntina. */
export function SpaceComingPage({ spaceKey }: { spaceKey: SpaceKey }) {
  const space = SPACES.find((item) => item.key === spaceKey) as SpaceDef;
  const { showToast } = useToast();
  const sectionRef = useRef<HTMLDivElement>(null);
  const needsNames = spaceKey === "children" || spaceKey === "pets";

  // The puntina of the bar is outside the page: «Annulla» focuses it by query.
  const buttonRefs = useRef(new Map<SpaceKey, HTMLElement>());
  useEffect(() => {
    const map = buttonRefs.current;
    map.set(spaceKey, {
      focus: () =>
        document
          .querySelector<HTMLElement>(".barra button[aria-pressed]")
          ?.focus(),
    } as HTMLElement);
    return () => {
      map.delete(spaceKey);
    };
  }, [spaceKey]);

  const pins = useSpaces(buttonRefs, { withNames: needsNames });
  const [interest, setInterest] = useState<InterestState>({
    status: "loading",
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [retryingInterest, startRetryInterest] = useTransition();
  const focusAfterRetry = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void readInterest(spaceKey).then((state) => {
      if (!cancelled) setInterest(state);
    });
    return () => {
      cancelled = true;
    };
  }, [spaceKey]);

  const status =
    pins.status === "loading" || interest.status === "loading"
      ? "loading"
      : pins.status === "error" || interest.status === "error"
        ? "error"
        : "ready";
  const retrying = pins.retrying || retryingInterest;
  const interestOn = interest.status === "ready" && interest.on;

  const retry = () => {
    focusAfterRetry.current = true;
    pins.retry(() => undefined);
    startRetryInterest(async () => {
      setInterest(await readInterest(spaceKey));
    });
  };

  // After a successful «Riprova» the focus goes to the «Avvisami» button.
  useEffect(() => {
    if (status === "ready" && focusAfterRetry.current) {
      focusAfterRetry.current = false;
      sectionRef.current
        ?.querySelector<HTMLElement>(`[data-testid="${INTEREST_BUTTON}"]`)
        ?.focus();
    }
  }, [status]);

  // `Button` has no `aria-pressed`: it is set on the same element, which is
  // never unmounted, so the focus stays on it.
  useEffect(() => {
    sectionRef.current
      ?.querySelector(`[data-testid="${INTEREST_BUTTON}"]`)
      ?.setAttribute("aria-pressed", String(interestOn));
  }, [interestOn, status]);

  const toggleInterest = useCallback(async () => {
    if (savingRef.current || interest.status !== "ready") return;
    savingRef.current = true;
    setSaving(true);
    const adding = !interest.on;
    let failed = false;
    try {
      const { error } = adding
        ? await addSpaceInterest(createClient(), spaceKey)
        : await removeSpaceInterest(createClient(), spaceKey);
      failed = error !== null;
    } catch {
      failed = true;
    }
    savingRef.current = false;
    setSaving(false);
    if (failed) {
      showToast({
        icon: null,
        text: adding
          ? "Non siamo riusciti ad attivare l'avviso per"
          : "Non siamo riusciti a togliere l'avviso per",
        emphasis: space.name,
        after: ". Riprova tra qualche secondo.",
      });
      return;
    }
    setInterest({ status: "ready", on: adding });
    showToast(
      adding
        ? {
            icon: "check",
            text: "Ti avvisiamo quando",
            emphasis: space.name,
            after: " è pronto.",
          }
        : {
            icon: "check",
            text: "Non ti avvisiamo più per",
            emphasis: space.name,
            after: ".",
          },
    );
  }, [interest, showToast, space.name, spaceKey]);

  const isPinned = pins.pinned.includes(spaceKey);
  const promise = `${getSpacePromise(spaceKey, {
    childNames: pins.data?.children.map((p) => p.name),
    petNames: pins.data?.pets.map((p) => p.name),
  })} Stiamo preparando questo spazio.`;
  const waitingForNames = needsNames && status === "loading";

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      {status === "ready" ? (
        <BarAction
          icon="pin"
          label={getPinLabel(space.name, isPinned)}
          pressed={isPinned}
          onClick={() => void pins.toggle(spaceKey)}
        />
      ) : null}
      <Button
        variant="link-secondario"
        href="/esplora"
        className="spazio-arrivo__desktop"
      >
        <span aria-hidden="true">←</span> Esplora
      </Button>
      <div ref={sectionRef} className="sezione spazio-arrivo">
        <span className="stato-vuoto__icona" aria-hidden="true">
          <Icon name={space.icon} />
        </span>
        <span className="etichetta">
          <Icon name="hourglass" size="s" />
          In arrivo
        </span>
        <h1 className="t-display">{space.name}</h1>
        {waitingForNames ? (
          <>
            <Skeleton shape="testo" />
            <Skeleton shape="testo-corto" />
          </>
        ) : (
          <p className="t-corpo t-secondario">{promise}</p>
        )}
        {space.rows.length > 0 ? (
          <ul className="scheda lista">
            {space.rows.map((row) => (
              <li key={row.text} className="riga-lista">
                <span className="icona-riquadro">
                  <Icon name={row.icon} />
                </span>
                <span className="riga-lista__testo">
                  <span className="riga-lista__titolo">{row.text}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {status === "loading" ? (
          <SkeletonGroup aria-live="polite">
            <Skeleton shape="bottone" />
          </SkeletonGroup>
        ) : null}
        {status === "error" ? (
          <Alert
            variant="errore"
            action={
              <Button variant="link" loading={retrying} onClick={retry}>
                Riprova
              </Button>
            }
          >
            Non riusciamo a caricare le tue scelte per <b>{space.name}</b>.
            Controlla la connessione e riprova.
          </Alert>
        ) : null}
        {status === "ready" ? (
          <Button
            variant={interestOn ? "secondary" : "primary"}
            full
            icon={interestOn ? "check" : "bell"}
            loading={saving}
            onClick={() => void toggleInterest()}
            data-testid={INTEREST_BUTTON}
          >
            {interestOn
              ? "Ti avvisiamo appena è pronto"
              : "Avvisami quando è pronto"}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
