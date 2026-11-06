"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import {
  ColorChoice,
  chosenFirstOrder,
  type ChoosableColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import { cx } from "@/components/ui/cx";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { ChoiceSheet, TimeSheet } from "./ChoiceSheets";
import { DangerZone } from "./DangerZone";
import {
  LENS_OPTIONS,
  VISIBILITY_OPTIONS,
  digestTimeLabel,
  lensLabel,
  visibilityLabel,
  type DeletionOutlook,
  type Failure,
  type Preferences,
} from "./model";
import {
  downloadMyData,
  saveColor,
  savePreference,
  type PreferencePatch,
} from "./save";

export type ProfileViewProps = {
  /** The h1: the name of the account, or the name in the Nest when it is empty */
  heading: string;
  /** The line under the name, already written by the server */
  subtitle: string;
  /** Name in the Nest: gives the initial of the avatar */
  memberName: string;
  color: ChoosableColor;
  /** Colours of the other members of the Nest, without names */
  taken: ChoosableColor[];
  preferences: Preferences;
  /** «Con Google», «Con la mail»… */
  accessText: string;
  householdName: string;
  outlook: DeletionOutlook;
  /** Row «Calendari collegati»: the providers, and how many calendars are on */
  calendars: { info: string; count: number | null };
};

type PrefKey = keyof Preferences;

const COLOR_ERROR: Record<Failure | "taken", string> = {
  taken: "Questo colore l'ha appena preso qualcun altro: scegline un altro.",
  network:
    "Non siamo riusciti a cambiare il colore. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a cambiare il colore per un problema nostro. Riprova tra qualche minuto.",
};

const PREFERENCE_ERROR: Record<Failure, string> = {
  network:
    "Non siamo riusciti a salvare la scelta. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a salvare la scelta per un problema nostro. Riprova tra qualche minuto.",
};

const DATA_ERROR: Record<Failure, string> = {
  network:
    "Non siamo riusciti a preparare i tuoi dati. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a preparare i tuoi dati per un problema nostro. Riprova tra qualche minuto.",
};

const failureIcon = (failure: Failure | "taken"): IconName =>
  failure === "network" ? "wifi-off" : "circle-alert";

function patchFor<K extends PrefKey>(
  key: K,
  value: Preferences[K],
): PreferencePatch {
  if (key === "lens") return { start_lens: value as Preferences["lens"] };
  if (key === "digestTime") {
    return { morning_digest_time: value as Preferences["digestTime"] };
  }
  return {
    default_event_visibility: value as Preferences["visibility"],
  };
}

/**
 * Content of «Il tuo profilo» (mockup 27): head with the colour, the choices of
 * «Come usi l'app», the account, and the two ways out. Renders a fragment:
 * every block is a direct child of `.colonna`. Colours and preferences are
 * saved at the touch, shown at once and put back if the save fails.
 */
export function ProfileView({
  heading,
  subtitle,
  memberName,
  color: initialColor,
  taken: initialTaken,
  preferences,
  accessText,
  householdName,
  outlook,
  calendars,
}: ProfileViewProps) {
  const router = useRouter();
  const { showToast } = useToast();

  /* ---------- Colour ---------- */
  const [color, setColor] = useState<ChoosableColor>(initialColor);
  const [takenColors, setTakenColors] =
    useState<ChoosableColor[]>(initialTaken);
  // Computed once when the page opens: the circles do not move under the finger.
  const [order] = useState(() =>
    chosenFirstOrder(
      initialColor,
      initialTaken.map((c) => ({ color: c })),
    ),
  );
  const [colorBusy, setColorBusy] = useState(false);
  const [colorError, setColorError] = useState<Failure | "taken" | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const savedColor = useRef<ChoosableColor>(initialColor);
  const wantedColor = useRef<ChoosableColor>(initialColor);
  const savingColor = useRef(false);
  const headRef = useRef<HTMLDivElement>(null);

  const takenForGroup = useMemo(
    () => takenColors.map((c) => ({ color: c })),
    [takenColors],
  );

  // After a failed save the focus goes to the colour that is chosen again.
  useEffect(() => {
    if (focusTick === 0) return;
    headRef.current
      ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus();
  }, [focusTick]);

  async function onColorChange(next: ChoosableColor) {
    if (next === wantedColor.current) return;
    setColorError(null);
    setColor(next);
    wantedColor.current = next;
    // One write at a time: a colour chosen meanwhile is saved at the end.
    if (savingColor.current) return;
    savingColor.current = true;
    setColorBusy(true);
    const before = savedColor.current;

    while (wantedColor.current !== savedColor.current) {
      const target = wantedColor.current;
      const result = await saveColor(target);
      if (result.ok) {
        savedColor.current = target;
        continue;
      }
      wantedColor.current = savedColor.current;
      setColor(savedColor.current);
      if (result.reason === "taken") {
        setTakenColors((list) =>
          list.includes(target) ? list : [...list, target],
        );
      }
      setColorError(result.reason);
      setFocusTick((tick) => tick + 1);
      break;
    }

    savingColor.current = false;
    setColorBusy(false);
    // The Nest square in the frame shows the new colour.
    if (savedColor.current !== before) router.refresh();
  }

  /* ---------- Preferences ---------- */
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const prefsRef = useRef<Preferences>(preferences);
  const [sheet, setSheet] = useState<PrefKey | null>(null);
  const [closeRequested, setCloseRequested] = useState(false);
  const [prefBusy, setPrefBusy] = useState<ReadonlySet<PrefKey>>(new Set());
  const [prefError, setPrefError] = useState<Failure | null>(null);
  const writeCount = useRef<Record<PrefKey, number>>({
    lens: 0,
    digestTime: 0,
    visibility: 0,
  });

  function openSheet(key: PrefKey) {
    setCloseRequested(false);
    setSheet(key);
  }

  function showPref<K extends PrefKey>(key: K, value: Preferences[K]) {
    prefsRef.current = { ...prefsRef.current, [key]: value };
    setPrefs(prefsRef.current);
  }

  function markBusy(key: PrefKey, busy: boolean) {
    setPrefBusy((current) => {
      const next = new Set(current);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function onChoose<K extends PrefKey>(key: K, value: Preferences[K]) {
    setCloseRequested(true);
    const before = prefsRef.current[key];
    // The same option as now: the sheet closes, nothing is written.
    if (value === before) return;
    writeCount.current[key] += 1;
    const mine = writeCount.current[key];
    setPrefError(null);
    showPref(key, value);
    markBusy(key, true);

    const result = await savePreference(patchFor(key, value));

    // A newer choice of the same row took over: it closes the busy state.
    if (writeCount.current[key] !== mine) return;
    markBusy(key, false);
    if (!result.ok) {
      showPref(key, before);
      setPrefError(result.reason);
      return;
    }
    // The frame reads the starting lens and the visibility again.
    router.refresh();
  }

  /* ---------- «I tuoi dati» ---------- */
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const [dataError, setDataError] = useState<Failure | null>(null);

  async function onDownload() {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setDataError(null);
    const result = await downloadMyData();
    exportingRef.current = false;
    setExporting(false);
    if (result.ok) {
      showToast({
        text: "Dati scaricati: trovi il file tra i download.",
        icon: "download",
        withoutNav: true,
      });
    } else {
      setDataError(result.reason);
    }
  }

  const row = (
    key: PrefKey,
    icon: IconName,
    title: string,
    info: string,
    value: string,
  ) => (
    <li>
      <button
        type="button"
        className="riga-lista riga-lista--cliccabile"
        aria-haspopup="dialog"
        aria-busy={prefBusy.has(key) || undefined}
        onClick={() => openSheet(key)}
      >
        <span className="icona-riquadro">
          <Icon name={icon} />
        </span>
        <span className="riga-lista__testo">
          <span className="riga-lista__titolo">{title}</span>
          <span className="riga-lista__info">{info}</span>
        </span>
        <span className="riga-lista__valore">
          {value}
          <Icon name="chevron-right" size="s" />
        </span>
      </button>
    </li>
  );

  return (
    <>
      <div className="profilo-testa profilo-testa--riga">
        <Avatar name={memberName} color={color} size="xl" nameShown />
        <div className="intestazione" ref={headRef}>
          <h1 className="t-titolo-pagina">{heading}</h1>
          <p className="intestazione__sotto">{subtitle}</p>
          <ColorChoice
            aria-label="Il tuo colore"
            value={color}
            order={order}
            taken={takenForGroup}
            busy={colorBusy}
            onChange={(next) => void onColorChange(next)}
          />
        </div>
      </div>

      {colorError ? (
        <Alert variant="errore" icon={failureIcon(colorError)}>
          {COLOR_ERROR[colorError]}
        </Alert>
      ) : null}

      <section className="sezione" aria-labelledby="profilo-uso-titolo">
        <div className="sezione__testa">
          <h2 className="sezione__titolo" id="profilo-uso-titolo">
            Come usi l&apos;app
          </h2>
        </div>
        <ul className="scheda lista">
          {row(
            "lens",
            "user-round",
            "All'apertura",
            "La lente con cui si apre Oggi",
            lensLabel(prefs.lens),
          )}
          {row(
            "digestTime",
            "sunrise",
            "Sintesi del mattino",
            "La tua giornata in una frase",
            digestTimeLabel(prefs.digestTime),
          )}
          {row(
            "visibility",
            "eye-off",
            "Visibilità predefinita",
            "Per le cose che aggiungi con «Io»",
            visibilityLabel(prefs.visibility),
          )}
          <li>
            <Link
              className="riga-lista riga-lista--cliccabile"
              href="/calendari-collegati"
            >
              <span className="icona-riquadro">
                <Icon name="calendar-arrow-down" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Calendari collegati</span>
                <span className="riga-lista__info">{calendars.info}</span>
              </span>
              <span className="riga-lista__valore">
                {calendars.count}
                <Icon name="chevron-right" size="s" />
              </span>
            </Link>
          </li>
        </ul>
        {prefError ? (
          <Alert variant="errore" icon={failureIcon(prefError)}>
            {PREFERENCE_ERROR[prefError]}
          </Alert>
        ) : null}
      </section>

      <section className="sezione" aria-labelledby="profilo-account-titolo">
        <div className="sezione__testa">
          <h2 className="sezione__titolo" id="profilo-account-titolo">
            Account
          </h2>
        </div>
        <ul className="scheda lista">
          <li>
            <div className="riga-lista">
              <span className="icona-riquadro">
                <Icon name="key-round" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Accesso</span>
                <span className="riga-lista__info">{accessText}</span>
              </span>
            </div>
          </li>
          <li>
            <button
              type="button"
              className={cx(
                "riga-lista riga-lista--cliccabile",
                exporting && "is-caricamento",
              )}
              aria-busy={exporting || undefined}
              aria-disabled={exporting || undefined}
              onClick={() => void onDownload()}
            >
              <span className="icona-riquadro">
                <Icon name="download" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">I tuoi dati</span>
                <span className="riga-lista__info">
                  Scarica tutto quello che hai inserito
                </span>
              </span>
              <span className="riga-lista__valore riga-lista__valore--icona">
                {exporting ? <Spinner /> : <Icon name="chevron-right" />}
              </span>
            </button>
          </li>
        </ul>
        {dataError ? (
          <Alert variant="errore" icon={failureIcon(dataError)}>
            {DATA_ERROR[dataError]}
          </Alert>
        ) : null}
      </section>

      <DangerZone householdName={householdName} initialOutlook={outlook} />

      <ChoiceSheet
        open={sheet === "lens"}
        closeRequested={closeRequested}
        onClose={() => setSheet(null)}
        title="All'apertura"
        options={LENS_OPTIONS}
        value={prefs.lens}
        onChoose={(value) => void onChoose("lens", value)}
      />
      <TimeSheet
        open={sheet === "digestTime"}
        closeRequested={closeRequested}
        onClose={() => setSheet(null)}
        value={prefs.digestTime}
        onChoose={(value) => void onChoose("digestTime", value)}
      />
      <ChoiceSheet
        open={sheet === "visibility"}
        closeRequested={closeRequested}
        onClose={() => setSheet(null)}
        title="Visibilità predefinita"
        intro="Vale per gli impegni che aggiungi con «Io». Puoi sempre cambiarla mentre li aggiungi."
        options={VISIBILITY_OPTIONS}
        value={prefs.visibility}
        onChoose={(value) => void onChoose("visibility", value)}
      />
    </>
  );
}
