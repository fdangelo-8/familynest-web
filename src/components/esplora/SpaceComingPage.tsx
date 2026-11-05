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
import { getSpacePromise, SPACES, type SpaceKey } from "@/lib/spaces";
import { createClient } from "@/lib/supabase/client";
import { useSpaces, type NamesRead } from "./useSpaces";

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
  const space = SPACES.find((item) => item.key === spaceKey);
  if (!space) throw new Error("Unknown space");
  const { showToast } = useToast();
  const interestRef = useRef<HTMLButtonElement>(null);
  // Only the names the promise needs: children for Crescere, pets for Zampe.
  const names: NamesRead =
    spaceKey === "children"
      ? "children"
      : spaceKey === "pets"
        ? "pets"
        : "none";
  const needsNames = names !== "none";

  // The puntina of the bar is outside the page: «Annulla» focuses it by query.
  const buttonRefs = useRef(new Map<SpaceKey, { focus: () => void }>());
  useEffect(() => {
    const map = buttonRefs.current;
    map.set(spaceKey, {
      focus: () =>
        document
          .querySelector<HTMLElement>(".barra button[aria-pressed]")
          ?.focus(),
    });
    return () => {
      map.delete(spaceKey);
    };
  }, [spaceKey]);

  const pins = useSpaces(buttonRefs, names);
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
      interestRef.current?.focus();
    }
  }, [status]);

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
    childNames: pins.data?.children ?? undefined,
    petNames: pins.data?.pets ?? undefined,
  })} Stiamo preparando questo spazio.`;
  const loading = status === "loading";

  const rows =
    space.rows.length > 0 ? (
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
    ) : null;

  const head = (
    <>
      <span className="stato-vuoto__icona" aria-hidden="true">
        <Icon name={space.icon} />
      </span>
      <span className="etichetta">
        <Icon name="hourglass" size="s" />
        In arrivo
      </span>
      <h1 className="t-display">{space.name}</h1>
    </>
  );

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
      <div className="sezione spazio-arrivo">
        {head}
        {loading && needsNames ? (
          // One busy area: the two lines of the promise, the rows and the button.
          <SkeletonGroup aria-live="polite">
            <Skeleton shape="testo" />
            <Skeleton shape="testo-corto" />
            {rows}
            <Skeleton shape="bottone" />
          </SkeletonGroup>
        ) : (
          <>
            <p className="t-corpo t-secondario">{promise}</p>
            {rows}
            {loading ? (
              <SkeletonGroup aria-live="polite">
                <Skeleton shape="bottone" />
              </SkeletonGroup>
            ) : null}
          </>
        )}
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
            buttonRef={interestRef}
            variant={interestOn ? "secondary" : "primary"}
            full
            icon={interestOn ? "check" : "bell"}
            pressed={interestOn}
            loading={saving}
            onClick={() => void toggleInterest()}
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
