"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { clearLinkResult } from "@/app/(app)/calendari-collegati/actions";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { Toggle } from "@/components/ui/Toggle/Toggle";
import { CalendarSheet } from "./CalendarSheet";
import { ConnectForm } from "./ConnectForm";
import { ConnectSheet } from "./ConnectSheet";
import { TargetSheet, type TargetOption } from "./TargetSheet";
import {
  LOGO_CLASS,
  PROVIDER_NAME,
  calendarSummary,
  canBeTarget,
  syncProgressText,
  type AccountItem,
  type CalendarItem,
  type LinkNotice,
  type ProviderKey,
  type SheetState,
} from "./model";
import {
  readSyncMarks,
  requestSync,
  setCalendarEnabled,
  type CalendarChoices,
} from "./save";

export type CalendarsViewProps = {
  accounts: AccountItem[];
  myName: string;
  /** First names of the other adults with an account */
  others: string[];
  /** Accounts out of date: they are synchronised when the page opens */
  staleAccountIds: string[];
  /** «15:40»: when the page was read */
  loadedAt: string;
  /** Mail of the account just linked again (read from the database); the sentence depends on `linkNotice.result` */
  alreadyLinkedEmail: string | null;
  /** What the way back from the provider said, if the adult just came back */
  linkNotice: LinkNotice | null;
};

const SAVE_ERROR =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
const POLL_MS = 800;

/** Microsoft pages where the permission given to an app can be taken away. */
const MICROSOFT_PERSONAL = "https://account.live.com/consent/Manage";
const MICROSOFT_WORK = "https://myapps.microsoft.com";

function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

/** Keeps the order of the rows the adult is looking at when the server sends new data. */
function mergeAccounts(
  previous: AccountItem[],
  next: AccountItem[],
): AccountItem[] {
  return next.map((account) => {
    const before = previous.find((a) => a.id === account.id);
    if (!before) return account;
    const rank = new Map(before.calendars.map((c, index) => [c.id, index]));
    const fresh = account.calendars.filter((c) => !rank.has(c.id));
    const kept = account.calendars
      .filter((c) => rank.has(c.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    return { ...account, calendars: [...kept, ...fresh] };
  });
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * «Calendari collegati» (mockup 26): one section per account with a row per
 * calendar, «Collega un altro account», «Dove vanno i nuovi impegni», and the
 * notices. Renders a fragment: every block is a direct child of `.colonna`.
 *
 * Switches save at the touch and go back if the save fails; the choices of a
 * calendar save together with «Salva» in its sheet. Credentials are never here:
 * the browser only sees the mail of the account and the names of the calendars
 * of the adult who is looking.
 */
export function CalendarsView({
  accounts: initialAccounts,
  myName,
  others,
  staleAccountIds,
  loadedAt,
  alreadyLinkedEmail,
  linkNotice,
}: CalendarsViewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  /* ---------- data ---------- */
  const [accounts, setAccounts] = useState(initialAccounts);
  const [seen, setSeen] = useState(initialAccounts);
  if (seen !== initialAccounts) {
    setSeen(initialAccounts);
    setAccounts((current) => mergeAccounts(current, initialAccounts));
  }
  const accountsRef = useRef(accounts);
  useEffect(() => {
    accountsRef.current = accounts;
  });

  const patchCalendar = useCallback(
    (calendarId: string, patch: Partial<CalendarItem>) => {
      setAccounts((current) =>
        current.map((account) => ({
          ...account,
          calendars: account.calendars.map((c) =>
            c.id === calendarId ? { ...c, ...patch } : c,
          ),
        })),
      );
    },
    [],
  );

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  /* ---------- notices ---------- */
  const [notice] = useState(linkNotice);
  const [saveError, setSaveError] = useState(false);
  const [unlinked, setUnlinked] = useState<ProviderKey | null>(null);
  const [sync, setSync] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(
    null,
  );
  const [sheet, setSheet] = useState<SheetState>(null);

  /* ---------- focus ---------- */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionHeadings = useRef(new Map<string, HTMLHeadingElement>());

  const focusMainIfLost = useCallback(() => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        document.getElementById("contenuto")?.focus();
      }
    }, 600);
  }, []);

  /* ---------- synchronisation started from the page ---------- */
  const syncing = useRef(false);
  const runSync = useCallback(
    async (options: {
      accountId?: string;
      /** Accounts the work covers, for «n calendari su N» */
      covered: string[];
      calendarId?: string;
    }) => {
      const ids = accountsRef.current
        .filter((a) => options.covered.includes(a.id))
        .flatMap((a) => a.calendars)
        .filter((c) => c.isEnabled)
        .map((c) => c.id);
      // One progress notice at a time, and none when there is nothing to count.
      const showProgress = !syncing.current && ids.length > 0;
      if (showProgress) syncing.current = true;
      let before: Map<string, string | null> | null = null;
      if (showProgress) {
        before = await readSyncMarks();
        setSync({ done: 0, total: ids.length });
        setSyncingCalendarId(options.calendarId ?? null);
      }
      let stop = false;
      const poll = async () => {
        while (!stop) {
          await sleep(POLL_MS);
          if (stop || !before) continue;
          const marks = await readSyncMarks();
          if (!marks || stop) continue;
          const done = ids.filter((id) => {
            const now = marks.get(id);
            return now && now !== before?.get(id);
          }).length;
          setSync({ done, total: ids.length });
        }
      };
      if (showProgress) void poll();
      await requestSync(options.accountId);
      stop = true;
      if (showProgress) {
        syncing.current = false;
        setSync(null);
        setSyncingCalendarId(null);
      }
      refresh();
    },
    [refresh],
  );

  // When the page opens: what is out of date is synchronised (#34 §7).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (staleAccountIds.length > 0 && navigator.onLine) {
      void runSync({ covered: staleAccountIds });
    }
  }, [staleAccountIds, runSync]);

  // The adult is back from the provider: the result is shown once.
  const shown = useRef(false);
  useEffect(() => {
    if (!notice || shown.current) return;
    shown.current = true;
    void clearLinkResult().catch(() => undefined);
    if (notice.result === "already_linked" || notice.result === "relinked") {
      if (alreadyLinkedEmail) {
        showToast({
          icon: null,
          lead: alreadyLinkedEmail,
          text:
            notice.result === "relinked" ? "ricollegato." : "è già collegato.",
          withoutNav: true,
        });
      }
      return;
    }
    if (notice.result !== "linked") return;
    showToast({
      lead: PROVIDER_NAME[notice.provider],
      text: "collegato. Scegli quali calendari portare qui.",
      withoutNav: true,
    });
    const last = accountsRef.current
      .filter((a) => a.provider === notice.provider)
      .at(-1);
    if (last) sectionHeadings.current.get(last.id)?.focus();
  }, [notice, alreadyLinkedEmail, showToast]);

  /* ---------- switches ---------- */
  const inFlight = useRef(new Set<string>());
  // «Annulla» of the toast switches the calendar on again with the latest `toggle`.
  const toggleRef = useRef<
    (calendarId: string, next: boolean) => Promise<void>
  >(async () => undefined);
  const toggle = useCallback(
    async (calendarId: string, next: boolean) => {
      if (inFlight.current.has(calendarId)) return;
      const account = accountsRef.current.find((a) =>
        a.calendars.some((c) => c.id === calendarId),
      );
      const calendar = account?.calendars.find((c) => c.id === calendarId);
      if (!account || !calendar) return;
      inFlight.current.add(calendarId);
      setSaveError(false);
      patchCalendar(calendarId, {
        isEnabled: next,
        isTarget: next ? calendar.isTarget : false,
      });
      const saved = await setCalendarEnabled(calendarId, next);
      inFlight.current.delete(calendarId);
      if (!saved.ok) {
        patchCalendar(calendarId, {
          isEnabled: !next,
          isTarget: calendar.isTarget,
        });
        setSaveError(true);
        return;
      }
      if (next) {
        void runSync({
          accountId: account.id,
          covered: [account.id],
          calendarId,
        });
        return;
      }
      showToast({
        lead: calendar.name,
        text: "non è più sincronizzato.",
        withoutNav: true,
        onUndo: () => void toggleRef.current(calendarId, true),
      });
      refresh();
    },
    [patchCalendar, refresh, runSync, showToast],
  );

  useEffect(() => {
    toggleRef.current = toggle;
  });

  /* ---------- sheets ---------- */
  const closeSheet = useCallback(() => setSheet(null), []);

  const onSaved = (calendarId: string, choices: CalendarChoices) => {
    patchCalendar(calendarId, {
      direction: choices.direction,
      visibility: choices.visibility,
      countsForFreeTime: choices.countsForFreeTime,
      weekdaysOnly: choices.weekdaysOnly,
      ...(choices.direction === "incoming" ? { isTarget: false } : {}),
    });
    refresh();
  };

  const onDisconnected = (account: AccountItem) => {
    setAccounts((current) => current.filter((a) => a.id !== account.id));
    setSheet(null);
    if (account.provider === "outlook") setUnlinked("outlook");
    showToast({
      lead: PROVIDER_NAME[account.provider],
      text: "scollegato.",
      withoutNav: true,
    });
    window.setTimeout(() => headingRef.current?.focus(), 0);
    refresh();
  };

  const onTargetSaved = (calendarId: string | null) => {
    setAccounts((current) =>
      current.map((account) => ({
        ...account,
        calendars: account.calendars.map((c) => ({
          ...c,
          isTarget: c.id === calendarId,
        })),
      })),
    );
    refresh();
  };

  const allCalendars = useMemo(
    () =>
      accounts.flatMap((account) =>
        account.calendars.map((calendar) => ({ account, calendar })),
      ),
    [accounts],
  );
  const targetOptions: TargetOption[] = allCalendars
    .filter(({ calendar }) => canBeTarget(calendar))
    .map(({ account, calendar }) => ({
      calendarId: calendar.id,
      name: calendar.name,
      provider: account.provider,
      email: account.email,
    }));
  const target = allCalendars.find(
    ({ calendar }) => calendar.isTarget && canBeTarget(calendar),
  );

  const openCalendar = sheet?.kind === "calendar" ? sheet : null;
  const openAccount = accounts.find((a) => a.id === openCalendar?.accountId);
  const openItem = openAccount?.calendars.find(
    (c) => c.id === openCalendar?.calendarId,
  );

  /* ---------- notices on screen ---------- */
  const retryOnline = () => refresh();
  const reconnect = (account: AccountItem, label: string): ReactNode => (
    <ConnectForm provider={account.provider}>
      {(loading) => (
        <Button
          variant="link"
          type="submit"
          loading={loading}
          disabled={!online}
        >
          {label}
        </Button>
      )}
    </ConnectForm>
  );

  const linkAlert = (() => {
    if (
      !notice ||
      notice.result === "linked" ||
      notice.result === "already_linked" ||
      notice.result === "relinked"
    ) {
      return null;
    }
    const name = PROVIDER_NAME[notice.provider];
    const retry = (
      <ConnectForm provider={notice.provider}>
        {(loading) => (
          <Button
            variant="link"
            type="submit"
            loading={loading}
            disabled={!online}
          >
            Riprova
          </Button>
        )}
      </ConnectForm>
    );
    switch (notice.result) {
      case "denied":
        return (
          // Information, not an error (info icon); announced at once because
          // the adult has just come back and is waiting for the outcome (CA-7).
          <Alert variant="info" role="alert" action={retry}>
            Collegamento con <b>{name}</b> annullato: senza il tuo permesso non
            possiamo leggere il calendario.
          </Alert>
        );
      case "no_calendar_permission":
        return notice.provider === "outlook" ? (
          <Alert variant="errore" action={retry}>
            Questo account Outlook non ha un calendario che possiamo leggere.
            Prova con un altro account o chiedi all&apos;ufficio informatico.
          </Alert>
        ) : (
          <Alert variant="errore" action={retry}>
            <b>{name}</b> ci ha dato l&apos;accesso all&apos;account ma non al
            calendario. Riprova e lascia la spunta su «Calendario».
          </Alert>
        );
      case "admin_approval":
        return (
          <Alert variant="errore" action={retry}>
            Il tuo account di lavoro non permette di collegare app esterne a
            Outlook. Chiedi a chi gestisce gli account in ufficio di approvare
            FamilyNest, oppure collega un altro calendario.
          </Alert>
        );
      case "limit":
        return (
          <Alert variant="errore">
            Hai già collegato 5 account, il massimo. Scollegane uno per
            aggiungerne un altro.
          </Alert>
        );
      default:
        return (
          <Alert variant="errore" icon="wifi-off" action={retry}>
            Non siamo riusciti a collegare <b>{name}</b>. Controlla la
            connessione e riprova.
          </Alert>
        );
    }
  })();

  const empty = accounts.length === 0;

  return (
    <>
      <div className="intestazione">
        <p className="intestazione__sopra">Impostazioni</p>
        <h1
          className="intestazione__titolo t-titolo-pagina"
          tabIndex={-1}
          ref={headingRef}
        >
          Calendari collegati
        </h1>
        <p className="intestazione__sotto">
          Scegli quali calendari portare in FamilyNest e cosa vedono gli altri.
        </p>
      </div>

      {!online ? (
        <Alert
          variant="errore"
          icon="wifi-off"
          action={
            <Button variant="link" onClick={retryOnline}>
              Riprova
            </Button>
          }
        >
          Sei offline. Vedi i calendari aggiornati alle {loadedAt}; per
          collegarli o cambiarli serve la connessione.
        </Alert>
      ) : null}
      {linkAlert}
      {saveError ? <Alert variant="errore">{SAVE_ERROR}</Alert> : null}
      {accounts
        .filter((a) => a.status === "reconnect")
        .map((account) => (
          <Alert
            key={account.id}
            variant="errore"
            icon="wifi-off"
            action={reconnect(account, "Ricollega")}
          >
            Non riusciamo a sincronizzare{" "}
            <b>{PROVIDER_NAME[account.provider]}</b>
            {account.failingSince ? ` ${account.failingSince}` : ""}: la
            password potrebbe essere cambiata.
          </Alert>
        ))}
      {accounts
        .filter((a) => a.status === "temporary_error" && a.silentForDay)
        .map((account) => (
          <Alert
            key={account.id}
            variant="avviso"
            action={
              <Button
                variant="link"
                disabled={!online}
                onClick={() => {
                  void runSync({
                    accountId: account.id,
                    covered: [account.id],
                  }).then(focusMainIfLost);
                }}
              >
                Riprova
              </Button>
            }
          >
            <b>{PROVIDER_NAME[account.provider]}</b> non risponde
            {account.updatedAt
              ? `: vedi gli impegni aggiornati ${account.updatedAt}.`
              : "."}{" "}
            Riproviamo da soli.
          </Alert>
        ))}
      {unlinked === "outlook" ? (
        <Alert variant="info">
          FamilyNest non può più usare il tuo account <b>Outlook</b>. Se vuoi,
          togli il permesso anche dalla pagina Microsoft delle app con accesso
          al tuo account.
          <br />
          <a
            className="btn-link"
            href={MICROSOFT_PERSONAL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Account personale
          </a>{" "}
          <a
            className="btn-link"
            href={MICROSOFT_WORK}
            target="_blank"
            rel="noopener noreferrer"
          >
            Account di lavoro
          </a>
        </Alert>
      ) : null}
      {sync ? (
        <Alert variant="info" icon="refresh-cw">
          {syncProgressText(sync.done, sync.total)}
        </Alert>
      ) : null}

      {empty ? (
        <EmptyState
          large
          title="Nessun calendario collegato"
          text="Collega Google, Outlook o iCloud: i tuoi impegni arrivano qui da soli e gli altri vedono solo che sei occupato."
          actions={
            <>
              {(["google", "outlook"] as const).map((provider) => (
                <ConnectForm key={provider} provider={provider}>
                  {(loading) => (
                    <Button
                      variant="secondary"
                      type="submit"
                      full
                      loading={loading}
                      disabled={!online}
                    >
                      {`Collega ${PROVIDER_NAME[provider]}`}
                    </Button>
                  )}
                </ConnectForm>
              ))}
            </>
          }
        />
      ) : (
        <>
          {accounts.map((account) => (
            <AccountSection
              key={account.id}
              account={account}
              online={online}
              syncingCalendarId={syncingCalendarId}
              headingRef={(node) => {
                if (node) sectionHeadings.current.set(account.id, node);
                else sectionHeadings.current.delete(account.id);
              }}
              onToggle={(calendarId, next) => void toggle(calendarId, next)}
              onOpen={(calendarId) =>
                setSheet({
                  kind: "calendar",
                  accountId: account.id,
                  calendarId,
                })
              }
            />
          ))}

          <Button
            variant="tratteggiato"
            icon="plus"
            aria-haspopup="dialog"
            disabled={!online}
            onClick={() => setSheet({ kind: "connect" })}
          >
            Collega un altro account
          </Button>

          <ul className="scheda lista">
            <li>
              <button
                type="button"
                className="riga-lista riga-lista--cliccabile riga-lista--senza-inizio"
                aria-haspopup="dialog"
                disabled={!online}
                onClick={() => setSheet({ kind: "target" })}
              >
                <span className="riga-lista__testo">
                  <span className="riga-lista__titolo">
                    Dove vanno i nuovi impegni
                  </span>
                  <span className="riga-lista__info">
                    Quando scegli «Anche su» in Aggiungi
                  </span>
                </span>
                <span className="riga-lista__valore">
                  {target?.calendar.name ?? "Nessuno"}
                  <Icon name="chevron-right" size="s" />
                </span>
              </button>
            </li>
          </ul>
        </>
      )}

      {sheet?.kind === "connect" ? (
        <ConnectSheet offline={!online} onClose={closeSheet} />
      ) : null}
      {sheet?.kind === "target" ? (
        <TargetSheet
          options={targetOptions}
          currentId={target?.calendar.id ?? null}
          onClose={closeSheet}
          onSaved={onTargetSaved}
        />
      ) : null}
      {openAccount && openItem ? (
        <CalendarSheet
          key={openItem.id}
          account={openAccount}
          calendar={openItem}
          myName={myName}
          others={others}
          onClose={closeSheet}
          onSaved={onSaved}
          onDisconnected={onDisconnected}
        />
      ) : null}
    </>
  );
}

function AccountSection({
  account,
  online,
  syncingCalendarId,
  headingRef,
  onToggle,
  onOpen,
}: {
  account: AccountItem;
  online: boolean;
  syncingCalendarId: string | null;
  headingRef: (node: HTMLHeadingElement | null) => void;
  onToggle: (calendarId: string, next: boolean) => void;
  onOpen: (calendarId: string) => void;
}) {
  const baseId = useId();
  const name = PROVIDER_NAME[account.provider];
  return (
    <section
      className="sezione"
      aria-label={`Account ${name} ${account.email}`}
    >
      <div className="sezione__testa">
        <h2 className="sezione__titolo" tabIndex={-1} ref={headingRef}>
          {name}
        </h2>
        <span className="sezione__info">{account.email}</span>
      </div>
      <ul className="scheda lista">
        {account.calendars.length === 0 ? (
          <li className="riga-lista riga-lista--senza-inizio">
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">
                Nessun calendario in questo account
              </span>
              <span className="riga-lista__info">
                {`Crealo su ${name}: comparirà qui alla prossima sincronizzazione.`}
              </span>
            </span>
          </li>
        ) : null}
        {account.calendars.map((calendar) => {
          const infoId = `${baseId}-${calendar.id}`;
          const failing = calendar.isEnabled && calendar.failingSince;
          const summary =
            syncingCalendarId === calendar.id
              ? "Sincronizzazione in corso"
              : failing
                ? `Non si sincronizza ${calendar.failingSince}`
                : calendarSummary(calendar);
          return (
            <li
              className="riga-lista riga-lista--modificabile"
              key={calendar.id}
            >
              <span
                className={`logo-marchio logo-marchio--piccolo ${LOGO_CLASS[account.provider]}`}
                aria-hidden="true"
              >
                {calendar.initial}
              </span>
              <span className="riga-lista__testo">
                <button
                  type="button"
                  className="riga-lista__titolo"
                  aria-haspopup="dialog"
                  aria-label={`${calendar.name}: impostazioni`}
                  aria-describedby={infoId}
                  disabled={!online}
                  onClick={() => onOpen(calendar.id)}
                >
                  {calendar.name}
                </button>
                <span
                  id={infoId}
                  className={cx(
                    "riga-lista__info",
                    failing && "riga-lista__info--allerta",
                  )}
                >
                  {summary}
                </span>
              </span>
              <Toggle
                aria-label={`Sincronizza ${calendar.name}`}
                checked={calendar.isEnabled}
                disabled={!online}
                onChange={(next) => onToggle(calendar.id, next)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
