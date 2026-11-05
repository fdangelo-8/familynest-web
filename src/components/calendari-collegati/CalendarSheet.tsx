"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { useIsDesktop } from "@/components/ui/overlay";
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { Toggle } from "@/components/ui/Toggle/Toggle";
import {
  PROVIDER_NAME,
  joinNames,
  visibilityHelp,
  type AccountItem,
  type CalendarItem,
  type Direction,
  type Visibility,
} from "./model";
import {
  disconnectAccount,
  saveCalendarChoices,
  type CalendarChoices,
} from "./save";

const SAVE_ERROR =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
const DISCONNECT_ERROR =
  "Non siamo riusciti a scollegare l'account. Controlla la connessione e riprova.";

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Solo io" },
  { value: "busy", label: "Occupato" },
  { value: "household", label: "Tutti" },
] as const satisfies ReadonlyArray<{ value: Visibility; label: string }>;

export type CalendarSheetProps = {
  account: AccountItem;
  calendar: CalendarItem;
  myName: string;
  /** First names of the other adults with an account */
  others: readonly string[];
  /** Called after the exit animation, whatever the reason */
  onClose: () => void;
  /** The choices were saved */
  onSaved: (calendarId: string, choices: CalendarChoices) => void;
  /** The account was unlinked */
  onDisconnected: (account: AccountItem) => void;
};

/**
 * The settings of one calendar (mockup 26, «modale-aperta»): a sheet under
 * 1024 px, a modal from there. The choices are saved only with «Salva», all
 * together; «Chiudi», «Annulla», Esc and the veil close without saving.
 */
export function CalendarSheet({
  account,
  calendar,
  myName,
  others,
  onClose,
  onSaved,
  onDisconnected,
}: CalendarSheetProps) {
  const desktop = useIsDesktop();
  const formId = useId();
  const helpId = useId();
  const provider = PROVIDER_NAME[account.provider];
  const readOnly = calendar.isReadOnly;

  const [direction, setDirection] = useState<Direction>(
    readOnly ? "incoming" : calendar.direction,
  );
  const [visibility, setVisibility] = useState<Visibility>(calendar.visibility);
  const [counts, setCounts] = useState(calendar.countsForFreeTime);
  const [weekdays, setWeekdays] = useState(calendar.weekdaysOnly);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  // The focus opens on the direction that is chosen (after the sheet's own
  // first focus, which lands on «Chiudi»).
  useEffect(() => {
    groupRef.current
      ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus();
  }, []);

  const choose = (value: Direction) => {
    if (saving) return;
    if (value === "two_way" && readOnly) return;
    setDirection(value);
  };

  const onGroupKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) return;
    event.preventDefault();
    const radios = Array.from(
      groupRef.current?.querySelectorAll<HTMLElement>(
        '[role="radio"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    if (radios.length === 0) return;
    const at = radios.findIndex((r) => r === document.activeElement);
    const next =
      radios[(at + (forward ? 1 : -1) + radios.length) % radios.length];
    if (!next) return;
    next.focus();
    choose(next.dataset.value === "two_way" ? "two_way" : "incoming");
  };

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const choices: CalendarChoices = {
      direction: readOnly ? "incoming" : direction,
      visibility,
      countsForFreeTime: counts,
      weekdaysOnly: weekdays,
    };
    const result = await saveCalendarChoices(calendar.id, choices);
    setSaving(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    onSaved(calendar.id, choices);
    setCloseRequested(true);
  };

  const enabledNames = account.calendars
    .filter((c) => c.isEnabled)
    .map((c) => c.name);
  const unlinkText =
    enabledNames.length > 0
      ? `Gli impegni di ${joinNames(enabledNames)} spariscono da FamilyNest. Su ${provider} non cambia niente.`
      : `Su ${provider} non cambia niente.`;

  const radio = (
    value: Direction,
    title: string,
    info: string,
    disabled: boolean,
  ) => {
    const selected = direction === value;
    return (
      <button
        type="button"
        className="scelta"
        role="radio"
        data-value={value}
        aria-checked={selected}
        aria-disabled={disabled || undefined}
        tabIndex={selected ? 0 : -1}
        onClick={() => choose(value)}
      >
        <span className="scelta__radio" aria-hidden="true" />
        <span>
          <span className="scelta__titolo">{title}</span>
          <span className="scelta__info">{info}</span>
        </span>
        <span />
      </button>
    );
  };

  const saveButton = (
    <Button type="submit" form={formId} full={!desktop} loading={saving}>
      Salva
    </Button>
  );

  return (
    <>
      <Sheet
        open
        tall
        title={`${calendar.name} · ${provider}`}
        ariaLabel={`Impostazioni del calendario ${calendar.name}`}
        onClose={onClose}
        closeRequested={closeRequested}
        locked={saving}
        data-testid="foglio-calendario"
        footer={
          desktop ? (
            <>
              <Button
                variant="link-secondario"
                onClick={() => setCloseRequested(true)}
                inactive={saving}
              >
                Annulla
              </Button>
              {saveButton}
            </>
          ) : (
            saveButton
          )
        }
      >
        <form
          id={formId}
          className="modulo-foglio"
          onSubmit={submit}
          noValidate
        >
          <div className="campo">
            <span className="campo__etichetta">Direzione</span>
            <div
              ref={groupRef}
              className="gruppo-scelte"
              role="radiogroup"
              aria-label="Direzione"
              aria-describedby={readOnly ? helpId : undefined}
              onKeyDown={onGroupKey}
            >
              {radio(
                "two_way",
                "Entrata e uscita",
                `Quello che crei su ${provider} arriva qui, e puoi mandare su ${provider} gli impegni di FamilyNest.`,
                readOnly,
              )}
              {radio(
                "incoming",
                "Solo in entrata",
                // «di lavoro» only where the calendar is for work: Outlook (mockup, #35
                // CA-4); the other providers are personal calendars (#34 §5a).
                `Vedi i tuoi impegni${account.provider === "outlook" ? " di lavoro" : ""}, ma FamilyNest non scrive su ${provider}.`,
                false,
              )}
            </div>
            {readOnly ? (
              <p className="campo__aiuto" id={helpId}>
                {calendar.name} è di sola lettura su {provider}: si può solo
                portare qui.
              </p>
            ) : null}
          </div>

          <div className="campo">
            <span className="campo__etichetta">
              Chi vede questi impegni nel Nest
            </span>
            <SegmentedControl
              paper
              aria-label="Chi vede questi impegni nel Nest"
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(value) => {
                if (!saving) setVisibility(value);
              }}
            />
            <p className="campo__aiuto">
              {visibilityHelp(visibility, myName, others)}
            </p>
          </div>

          <ul className="scheda lista">
            <li className="riga-lista riga-lista--senza-inizio">
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  Conta per «Liberi insieme»
                </span>
                <span className="riga-lista__info">
                  Una serata con impegni di lavoro non è libera
                </span>
              </span>
              <Toggle
                aria-label="Conta per Liberi insieme"
                checked={counts}
                disabled={saving}
                onChange={setCounts}
              />
            </li>
            <li className="riga-lista riga-lista--senza-inizio">
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Solo giorni feriali</span>
                <span className="riga-lista__info">
                  Ignora gli eventi di sabato e domenica
                </span>
              </span>
              <Toggle
                aria-label="Solo giorni feriali"
                checked={weekdays}
                disabled={saving}
                onChange={setWeekdays}
              />
            </li>
          </ul>

          {calendar.isEnabled && calendar.failingSince ? (
            <Alert variant="errore">
              Non riusciamo a leggere <b>{calendar.name}</b> su {provider}{" "}
              {calendar.failingSince}: forse non è più condiviso con te.
            </Alert>
          ) : null}

          <p className="campo__aiuto">
            {calendar.lastSynced
              ? `Ultima sincronizzazione: ${calendar.lastSynced}.`
              : "Non ancora sincronizzato."}
          </p>

          <Button
            variant="pericolo"
            aria-haspopup="dialog"
            inactive={saving}
            onClick={() => setConfirming(true)}
          >
            {`Scollega l'account ${provider}`}
          </Button>

          {failed ? <Alert variant="errore">{SAVE_ERROR}</Alert> : null}
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        aboveSheet
        title={`Scollegare «${account.email}»?`}
        text={unlinkText}
        errorText={DISCONNECT_ERROR}
        onClose={() => setConfirming(false)}
        actions={[
          {
            label: "Scollega",
            variant: "pericolo-pieno",
            onClick: async () => {
              const result = await disconnectAccount(account.id);
              if (!result.ok) return false;
              onDisconnected(account);
              return true;
            },
          },
        ]}
      />
    </>
  );
}
