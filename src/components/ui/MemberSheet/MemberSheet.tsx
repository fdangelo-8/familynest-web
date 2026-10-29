"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toDateFieldValue } from "@/lib/datetime";
import { HOUSEHOLD_FULL_MESSAGE } from "@/lib/household-limits";
import { Alert } from "../Alert/Alert";
import { Button } from "../Button/Button";
import {
  ColorChoice,
  firstFreeColor,
  type ChoosableColor,
  type TakenColor,
} from "../ColorChoice/ColorChoice";
import { DateField, TextField } from "../Field/Field";
import { Icon } from "../Icon/Icon";
import { useIsDesktop } from "../overlay";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import { Sheet } from "../Sheet/Sheet";

export type MemberKind = "adult" | "child" | "pet";

/** What the user chose. `birthDate` is `YYYY-MM-DD` or `null` (always `null` for adults). */
export type MemberValues = {
  name: string;
  kind: MemberKind;
  birthDate: string | null;
  color: ChoosableColor;
};

/**
 * Outcome of saving, decided by the page (the sheet never talks to the
 * database): `color-taken` (23505 on the colour), `full` (Nest with 10
 * members), `network` (unreachable), `server` (any other failure).
 */
export type MemberSaveResult =
  | { ok: true }
  | { ok: false; reason: "color-taken" | "full" | "network" | "server" };

export type MemberToEdit = {
  name: string;
  kind: MemberKind;
  color: ChoosableColor;
  birthDate: string | null;
  /** Has a FamilyNest account: always an adult, the role cannot change */
  hasAccount?: boolean;
};

export type MemberSheetProps = {
  open: boolean;
  /** Runs after the sheet has left (X, Esc, veil, drag, "Annulla" or after saving) */
  onClose: () => void;
  /**
   * `add`: "Aggiungi una persona". `edit`: "Modifica <nome>", needs `member`.
   * `invite`: "Invita qualcuno", only name and colour, always an adult.
   */
  mode: "add" | "edit" | "invite";
  /** The member being changed (mode `edit`) */
  member?: MemberToEdit;
  /** Role chosen when the sheet opens in mode `add` (default `adult`) */
  defaultKind?: MemberKind;
  /** Colours of the OTHER members of the Nest */
  taken: ReadonlyArray<TakenColor>;
  /** Saves; the page decides the Nest and writes. Never receives anything but these values. */
  onSave: (values: MemberValues) => Promise<MemberSaveResult>;
  /** Runs once, right after a successful save, before the sheet leaves */
  onSaved?: (values: MemberValues) => void;
  /** Text under the title (mode `invite`), linked to the dialog with `aria-describedby` */
  intro?: string;
};

/** Provisional text of the invite sheet until member page #18 exists. */
export const INVITE_PROVISIONAL_INTRO =
  "Per ora aggiungi questa persona al Nest con nome e colore: il modo per mandarle l'invito lo stiamo preparando.";

export const NAME_MAX_LENGTH = 40;
const LONG_NAME = 20;

const KIND_OPTIONS: ReadonlyArray<{ value: MemberKind; label: string }> = [
  { value: "adult", label: "Adulto" },
  { value: "child", label: "Figlio o figlia" },
  { value: "pet", label: "Animale" },
];

type Failure = "network" | "server" | "full";

const FAILURE_TEXT: Record<Failure, string> = {
  network: "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.",
  full: HOUSEHOLD_FULL_MESSAGE,
};

const NAME_ERROR = "Scrivi il nome per continuare.";
const DATE_ERROR = "Questa data è nel futuro: scegli un giorno fino a oggi.";
const COLOR_TAKEN_ERROR =
  "Questo colore l'ha appena preso qualcun altro: scegline un altro.";

/**
 * Sheet to add or change a member of the Nest (mobile: bottom sheet; from
 * 1024 px: modal). Name, role, birth date (children and pets) and colour.
 * The state starts again every time it opens.
 */
export function MemberSheet(props: MemberSheetProps) {
  if (!props.open) return null;
  return <MemberSheetOpen {...props} />;
}

function MemberSheetOpen({
  onClose,
  mode,
  member,
  defaultKind = "adult",
  taken,
  onSave,
  onSaved,
  intro,
}: MemberSheetProps) {
  const base = useId();
  const formId = `${base}-form`;
  const nameId = `${base}-nome`;
  const introId = `${base}-intro`;
  const kindHelpId = `${base}-ruolo-aiuto`;
  const colorHelpId = `${base}-colore-aiuto`;
  const colorErrorId = `${base}-colore-errore`;
  const desktop = useIsDesktop();
  const colorRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const editing = mode === "edit" && member !== undefined;
  const invite = mode === "invite";

  const [name, setName] = useState(editing ? member.name : "");
  const [kind, setKind] = useState<MemberKind>(
    editing ? member.kind : invite ? "adult" : defaultKind,
  );
  const [birthDate, setBirthDate] = useState(
    editing ? (member.birthDate ?? "") : "",
  );
  const [color, setColor] = useState<ChoosableColor | null>(
    editing ? member.color : firstFreeColor(taken),
  );
  // Colours found taken while saving (another tab), on top of `taken`.
  const [justTaken, setJustTaken] = useState<ChoosableColor[]>([]);
  const [nameError, setNameError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [colorError, setColorError] = useState<string | undefined>();
  // No free colour at opening means the Nest is full.
  const [failure, setFailure] = useState<Failure | null>(
    !editing && firstFreeColor(taken) === null ? "full" : null,
  );
  const [colorFocusTick, setColorFocusTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const allTaken: TakenColor[] = [
    ...taken,
    ...justTaken
      .filter((c) => !taken.some((t) => t.color === c))
      .map((c) => ({ color: c })),
  ];

  const trimmed = name.trim();
  const showDate = !invite && kind !== "adult";
  const title = editing
    ? `Modifica ${member.name}`
    : invite
      ? "Invita qualcuno"
      : "Aggiungi una persona";
  const primaryLabel = editing
    ? "Salva le modifiche"
    : invite
      ? "Continua"
      : trimmed && trimmed.length <= LONG_NAME
        ? `Aggiungi ${trimmed}`
        : "Aggiungi";

  function focusColor() {
    colorRef.current
      ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
      ?.focus();
  }

  // After "colour taken in the meantime" the radios have just re-rendered.
  useEffect(() => {
    if (colorFocusTick > 0) focusColor();
  }, [colorFocusTick]);

  async function submit() {
    if (busy.current) return;

    const today = toDateFieldValue(new Date());
    const nextNameError = trimmed ? undefined : NAME_ERROR;
    const nextDateError =
      showDate && birthDate && birthDate > today ? DATE_ERROR : undefined;
    const nextColorError = color ? undefined : colorError;
    setNameError(nextNameError);
    setDateError(nextDateError);
    setColorError(nextColorError);
    setFailure(null);

    if (nextNameError) {
      document.getElementById(nameId)?.focus();
      return;
    }
    if (nextDateError) {
      document.getElementById(`${base}-nascita`)?.focus();
      return;
    }
    if (!color) {
      if (!colorError) setFailure("full");
      focusColor();
      return;
    }

    const values: MemberValues = {
      name: trimmed,
      kind: invite ? "adult" : kind,
      birthDate: showDate && birthDate ? birthDate : null,
      color,
    };

    busy.current = true;
    setSaving(true);
    let result: MemberSaveResult;
    try {
      result = await onSave(values);
    } catch {
      result = { ok: false, reason: "network" };
    }

    if (result.ok) {
      // Stays "saving" until the sheet has left: no second request.
      onSaved?.(values);
      setLeaving(true);
      return;
    }

    busy.current = false;
    setSaving(false);
    if (result.reason === "color-taken") {
      setJustTaken((list) => [...list, color]);
      setColor(null);
      setColorError(COLOR_TAKEN_ERROR);
      setColorFocusTick((n) => n + 1);
    } else {
      setFailure(result.reason);
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const primary = (
    <Button
      type="submit"
      form={formId}
      full={!desktop}
      loading={saving}
      data-testid="membro-salva"
    >
      {primaryLabel}
    </Button>
  );

  const footer = desktop ? (
    <>
      <Button
        variant="link-secondario"
        disabled={saving}
        onClick={() => setLeaving(true)}
      >
        Annulla
      </Button>
      {primary}
    </>
  ) : (
    primary
  );

  const kindHelp =
    editing && member.hasAccount
      ? "Chi usa FamilyNest con il suo account è sempre un adulto."
      : undefined;

  const colorDescribedBy = [colorHelpId, colorError ? colorErrorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      tall={!invite}
      footer={footer}
      locked={saving}
      closeRequested={leaving}
      aria-describedby={invite && intro ? introId : undefined}
      data-testid="membro-foglio"
    >
      <form
        id={formId}
        className="modulo-membro"
        method="post"
        noValidate
        onSubmit={onSubmit}
      >
        {invite && intro ? (
          <p className="t-nota t-secondario" id={introId}>
            {intro}
          </p>
        ) : null}

        <TextField
          id={nameId}
          label="Nome"
          placeholder="Come si chiama?"
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          value={name}
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />

        {invite ? null : (
          <div className="campo">
            <span className="campo__etichetta">Chi è</span>
            <SegmentedControl
              paper
              aria-label="Chi è"
              describedBy={kindHelp ? kindHelpId : undefined}
              value={kind}
              onChange={setKind}
              options={KIND_OPTIONS.map((option) => ({
                ...option,
                disabled: editing && option.value !== member.kind,
              }))}
            />
            {kindHelp ? (
              <p className="campo__aiuto" id={kindHelpId}>
                {kindHelp}
              </p>
            ) : null}
          </div>
        )}

        {showDate ? (
          <DateField
            id={`${base}-nascita`}
            label="Data di nascita"
            help="Serve a calcolare l'età e a ricordare il compleanno."
            max={toDateFieldValue(new Date())}
            value={birthDate}
            error={dateError}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        ) : null}

        <div
          ref={colorRef}
          className={colorError ? "campo campo--errore" : "campo"}
        >
          <span className="campo__etichetta">Colore</span>
          <ColorChoice
            aria-label="Colore"
            alignStart
            value={color}
            onChange={(next) => {
              setColor(next);
              setColorError(undefined);
            }}
            taken={allTaken}
            invalid={colorError ? true : undefined}
            describedBy={colorDescribedBy}
            idPrefix={`${base}-colore`}
          />
          <p className="campo__aiuto" id={colorHelpId}>
            I colori spenti sono già di qualcun altro.
          </p>
          {colorError ? (
            <p className="campo__errore" id={colorErrorId} role="alert">
              <Icon name="circle-alert" size="s" />
              {colorError}
            </p>
          ) : null}
        </div>

        {failure ? (
          <Alert
            variant="errore"
            icon={failure === "network" ? "wifi-off" : "circle-alert"}
            action={
              failure === "full" ? undefined : (
                <Button
                  variant="link"
                  onClick={() => {
                    // The alert is removed by the new attempt: keep the focus inside the dialog.
                    document
                      .querySelector<HTMLElement>(`[form="${formId}"]`)
                      ?.focus();
                    void submit();
                  }}
                >
                  Riprova
                </Button>
              )
            }
          >
            {FAILURE_TEXT[failure]}
          </Alert>
        ) : null}
      </form>
    </Sheet>
  );
}
