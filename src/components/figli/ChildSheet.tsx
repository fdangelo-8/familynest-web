"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import {
  ColorChoice,
  type ChoosableColor,
  type TakenColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import {
  DateField,
  FieldPair,
  SelectField,
  TextField,
  TimeField,
} from "@/components/ui/Field/Field";
import { Icon } from "@/components/ui/Icon/Icon";
import { useIsDesktop } from "@/components/ui/overlay";
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { toDateFieldValue } from "@/lib/datetime";
import {
  MEMBER_BIRTH_HELP,
  MEMBER_BIRTH_LABEL,
  MEMBER_COLOR_HELP,
  MEMBER_COLOR_LABEL,
  MEMBER_COLOR_TAKEN_ERROR,
  MEMBER_DATE_ERROR,
  MEMBER_FAILURE_TEXT,
  MEMBER_KIND_LABEL,
  MEMBER_KIND_OPTIONS,
  MEMBER_NAME_ERROR,
  MEMBER_NAME_LABEL,
  MEMBER_NAME_MAX_LENGTH,
  MEMBER_NAME_PLACEHOLDER,
  MEMBER_SAVE_LABEL,
} from "@/lib/member-texts";
import { MAX_TEACHERS, type ChildData } from "./model";
import type { ChildProfileValues, SaveResult } from "./save";

/** Which field gets the focus when the sheet opens. */
export type SheetFocus = "name" | "school" | "sizes";

export type ChildSheetProps = {
  open: boolean;
  /** Runs after the sheet has left (X, Esc, veil, drag, «Annulla» or after saving) */
  onClose: () => void;
  focusOn: SheetFocus;
  data: ChildData;
  /** Saves and reads again; the page decides the Nest and writes */
  onSave: (values: ChildProfileValues) => Promise<SaveResult>;
};

const SCHOOL_NAME_MAX = 60;
const CLASS_MAX = 20;
const NOTE_MAX = 60;
const TEACHER_NAME_MAX = 40;
const SUBJECT_MAX = 40;
const PHONE_MAX = 20;
const SIZE_MAX = 10;

const EXIT_ERROR = "Scegli anche l'ora d'uscita.";
const ENTRY_ERROR = "Scegli anche l'ora d'entrata.";
const ORDER_ERROR = "L'uscita deve essere dopo l'entrata.";
const NOTE_ERROR = "Per la nota serve anche l'orario.";
const TEACHER_NAME_ERROR = "Scrivi il nome della maestra.";
const PHONE_ERROR = "Scrivi solo numeri, spazi e il + all'inizio.";

const DAYS_OPTIONS = [
  { value: "5", label: "Dal lunedì al venerdì", days: [1, 2, 3, 4, 5] },
  { value: "6", label: "Dal lunedì al sabato", days: [1, 2, 3, 4, 5, 6] },
] as const;
type DaysChoice = (typeof DAYS_OPTIONS)[number]["value"];

const PHONE_CHARACTERS = /^\+?[0-9 ./()-]+$/;

/** Spaces at the ends out and repeated spaces made one, as the database does. */
const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();
const orNull = (text: string): string | null => normalize(text) || null;

type TeacherDraft = {
  key: number;
  name: string;
  subject: string;
  phone: string;
};

type FormState = {
  name: string;
  birthDate: string;
  color: ChoosableColor | null;
  schoolName: string;
  schoolClass: string;
  startsAt: string;
  endsAt: string;
  days: DaysChoice;
  note: string;
  teachers: TeacherDraft[];
  shoe: string;
  clothing: string;
  pajama: string;
};

/** The values the database gets, from what is written in the form. */
function toValues(
  form: FormState,
  color: ChoosableColor,
  teachers: ReadonlyArray<TeacherDraft>,
): ChildProfileValues {
  const startsAt = form.startsAt || null;
  const endsAt = form.endsAt || null;
  const hasTimetable = startsAt !== null && endsAt !== null;
  const choice = DAYS_OPTIONS.find((option) => option.value === form.days);
  return {
    name: normalize(form.name),
    birthDate: form.birthDate || null,
    color,
    schoolName: orNull(form.schoolName),
    schoolClass: orNull(form.schoolClass),
    startsAt,
    endsAt,
    days: hasTimetable && choice ? [...choice.days] : [],
    note: hasTimetable ? orNull(form.note) : null,
    shoeSize: orNull(form.shoe),
    clothingSize: orNull(form.clothing),
    pajamaSize: orNull(form.pajama),
    teachers: teachers
      .map((teacher) => ({
        name: normalize(teacher.name),
        subject: orNull(teacher.subject),
        phone: orNull(teacher.phone),
      }))
      .filter((teacher) => teacher.name || teacher.subject || teacher.phone),
  };
}

function initialForm(data: ChildData): FormState {
  const { profile } = data;
  const sixDays =
    profile.days.length === 6 && profile.days.every((d, i) => d === i + 1);
  return {
    name: data.child.name,
    birthDate: data.child.birthDate ?? "",
    color:
      data.child.color === "insieme"
        ? null
        : (data.child.color as ChoosableColor),
    schoolName: profile.schoolName ?? "",
    schoolClass: profile.schoolClass ?? "",
    startsAt: profile.startsAt ?? "",
    endsAt: profile.endsAt ?? "",
    // Days that are not one of the two choices (written outside the app) show
    // as «Dal lunedì al venerdì».
    days: sixDays ? "6" : "5",
    note: profile.note ?? "",
    teachers: data.teachers.map((teacher, index) => ({
      key: index,
      name: teacher.name,
      subject: teacher.subject ?? "",
      phone: teacher.phone ?? "",
    })),
    shoe: profile.shoeSize ?? "",
    clothing: profile.clothingSize ?? "",
    pajama: profile.pajamaSize ?? "",
  };
}

type FieldError = { key: string; id: string; text: string };

/**
 * Sheet «Modifica il profilo di <nome>» (mobile: bottom sheet; from 1024 px:
 * modal). The usual fields of a member, then school, teachers and sizes, saved
 * together in one call. The state starts again every time it opens.
 */
export function ChildSheet(props: ChildSheetProps) {
  if (!props.open) return null;
  return <ChildSheetOpen {...props} />;
}

function ChildSheetOpen({ onClose, focusOn, data, onSave }: ChildSheetProps) {
  const base = useId();
  const formId = `${base}-form`;
  const desktop = useIsDesktop();
  const colorRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const nextKey = useRef(data.teachers.length);
  const pendingFocus = useRef<string | null>(null);

  const [initial] = useState(() => initialForm(data));
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Colours found taken while saving (another tab), on top of the others'.
  const [justTaken, setJustTaken] = useState<ChoosableColor[]>([]);
  const [colorError, setColorError] = useState<string | undefined>();
  const [failure, setFailure] = useState<"network" | "server" | null>(null);
  const [colorFocusTick, setColorFocusTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const ids = {
    name: `${base}-nome`,
    birth: `${base}-nascita`,
    schoolName: `${base}-scuola`,
    schoolClass: `${base}-classe`,
    starts: `${base}-entra`,
    ends: `${base}-esce`,
    days: `${base}-giorni`,
    note: `${base}-nota`,
    add: `${base}-aggiungi-maestra`,
    shoe: `${base}-scarpe`,
    clothing: `${base}-vestiti`,
    pajama: `${base}-pigiama`,
  };
  const teacherId = (key: number, part: "nome" | "materia" | "telefono") =>
    `${base}-m${key}-${part}`;

  const taken: TakenColor[] = [
    ...data.taken,
    ...justTaken
      .filter((color) => !data.taken.some((t) => t.color === color))
      .map((color) => ({ color })),
  ];

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const updateTeacher = (key: number, patch: Partial<TeacherDraft>) =>
    setForm((current) => ({
      ...current,
      teachers: current.teachers.map((teacher) =>
        teacher.key === key ? { ...teacher, ...patch } : teacher,
      ),
    }));

  function focusColor() {
    colorRef.current
      ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
      ?.focus();
  }

  // The focus asked by the opener (this effect runs after the sheet's own
  // focus handling, which has just put it on the first field).
  useEffect(() => {
    const target =
      focusOn === "school"
        ? ids.schoolName
        : focusOn === "sizes"
          ? ids.shoe
          : null;
    if (target) document.getElementById(target)?.focus();
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After «colour taken in the meantime» the radios have just re-rendered.
  useEffect(() => {
    if (colorFocusTick > 0) focusColor();
  }, [colorFocusTick]);

  // Focus requested by an action (new teacher, teacher removed), once the
  // new fields are in the page.
  useEffect(() => {
    const id = pendingFocus.current;
    if (id) {
      pendingFocus.current = null;
      document.getElementById(id)?.focus();
    }
  });

  function addTeacher() {
    if (form.teachers.length >= MAX_TEACHERS) return;
    const key = nextKey.current++;
    pendingFocus.current = teacherId(key, "nome");
    setForm((current) => ({
      ...current,
      teachers: [
        ...current.teachers,
        { key, name: "", subject: "", phone: "" },
      ],
    }));
  }

  function removeTeacher(key: number) {
    const index = form.teachers.findIndex((teacher) => teacher.key === key);
    const next = form.teachers[index + 1];
    pendingFocus.current = next ? teacherId(next.key, "nome") : ids.add;
    setForm((current) => ({
      ...current,
      teachers: current.teachers.filter((teacher) => teacher.key !== key),
    }));
  }

  /** Errors in the order of the fields on the page. */
  function validate(): FieldError[] {
    const list: FieldError[] = [];
    const add = (key: string, id: string, text: string) =>
      list.push({ key, id, text });

    if (!normalize(form.name)) add("name", ids.name, MEMBER_NAME_ERROR);
    if (form.birthDate && form.birthDate > toDateFieldValue(new Date())) {
      add("birth", ids.birth, MEMBER_DATE_ERROR);
    }
    if (form.startsAt && !form.endsAt) add("ends", ids.ends, EXIT_ERROR);
    if (!form.startsAt && form.endsAt) add("starts", ids.starts, ENTRY_ERROR);
    if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) {
      add("ends", ids.ends, ORDER_ERROR);
    }
    if (!form.startsAt && !form.endsAt && normalize(form.note)) {
      add("note", ids.note, NOTE_ERROR);
    }
    for (const teacher of form.teachers) {
      const name = normalize(teacher.name);
      const subject = normalize(teacher.subject);
      const phone = normalize(teacher.phone);
      if (!name && !subject && !phone) continue;
      if (!name) {
        add(
          `t${teacher.key}-nome`,
          teacherId(teacher.key, "nome"),
          TEACHER_NAME_ERROR,
        );
      }
      if (phone) {
        const digits = phone.replace(/\D/g, "").length;
        if (!PHONE_CHARACTERS.test(phone) || digits < 6 || digits > 15) {
          add(
            `t${teacher.key}-telefono`,
            teacherId(teacher.key, "telefono"),
            PHONE_ERROR,
          );
        }
      }
    }
    return list;
  }

  async function submit() {
    if (busy.current) return;
    setFailure(null);

    const found = validate();
    setErrors(Object.fromEntries(found.map((e) => [e.key, e.text])));
    const first = found[0];
    if (first) {
      document.getElementById(first.id)?.focus();
      return;
    }
    if (!form.color) {
      focusColor();
      return;
    }

    const values = toValues(form, form.color, form.teachers);
    // Nothing changed: the sheet closes, nothing is sent and nothing is said.
    if (
      initial.color &&
      JSON.stringify(values) ===
        JSON.stringify(toValues(initial, initial.color, initial.teachers))
    ) {
      busy.current = true;
      setLeaving(true);
      return;
    }

    busy.current = true;
    setSaving(true);
    let result: SaveResult;
    try {
      result = await onSave(values);
    } catch {
      result = { ok: false, reason: "network" };
    }

    if (result.ok) {
      // Stays «saving» until the sheet has left: no second request.
      setLeaving(true);
      return;
    }

    busy.current = false;
    setSaving(false);
    if (result.reason === "color-taken") {
      const lost = form.color;
      setJustTaken((list) => [...list, lost]);
      update("color", null);
      setColorError(MEMBER_COLOR_TAKEN_ERROR);
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
      data-testid="figlio-salva"
    >
      {MEMBER_SAVE_LABEL}
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

  const colorHelpId = `${base}-colore-aiuto`;
  const colorErrorId = `${base}-colore-errore`;
  const colorDescribedBy = [colorHelpId, colorError ? colorErrorId : null]
    .filter(Boolean)
    .join(" ");
  const schoolTitleId = `${base}-t-scuola`;
  const teachersTitleId = `${base}-t-maestre`;
  const sizesTitleId = `${base}-t-taglie`;
  const full = form.teachers.length >= MAX_TEACHERS;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Modifica il profilo di ${data.child.name}`}
      tall
      footer={footer}
      locked={saving}
      closeRequested={leaving}
      data-testid="figlio-foglio"
    >
      <form
        id={formId}
        className="modulo-foglio"
        method="post"
        noValidate
        onSubmit={onSubmit}
      >
        <TextField
          id={ids.name}
          label={MEMBER_NAME_LABEL}
          placeholder={MEMBER_NAME_PLACEHOLDER}
          maxLength={MEMBER_NAME_MAX_LENGTH}
          autoComplete="off"
          value={form.name}
          error={errors["name"]}
          onChange={(event) => update("name", event.target.value)}
        />

        <div className="campo">
          <span className="campo__etichetta">{MEMBER_KIND_LABEL}</span>
          <SegmentedControl
            paper
            aria-label={MEMBER_KIND_LABEL}
            value="child"
            onChange={() => undefined}
            options={MEMBER_KIND_OPTIONS.map((option) => ({
              ...option,
              disabled: option.value !== "child",
            }))}
          />
        </div>

        <DateField
          id={ids.birth}
          label={MEMBER_BIRTH_LABEL}
          help={MEMBER_BIRTH_HELP}
          max={toDateFieldValue(new Date())}
          value={form.birthDate}
          error={errors["birth"]}
          onChange={(event) => update("birthDate", event.target.value)}
        />

        <div
          ref={colorRef}
          className={colorError ? "campo campo--errore" : "campo"}
        >
          <span className="campo__etichetta">{MEMBER_COLOR_LABEL}</span>
          <ColorChoice
            aria-label={MEMBER_COLOR_LABEL}
            alignStart
            value={form.color}
            onChange={(next) => {
              update("color", next);
              setColorError(undefined);
            }}
            taken={taken}
            invalid={colorError ? true : undefined}
            describedBy={colorDescribedBy}
            idPrefix={`${base}-colore`}
          />
          <p className="campo__aiuto" id={colorHelpId}>
            {MEMBER_COLOR_HELP}
          </p>
          {colorError ? (
            <p className="campo__errore" id={colorErrorId} role="alert">
              <Icon name="circle-alert" size="s" />
              {colorError}
            </p>
          ) : null}
        </div>

        <div
          className="modulo-gruppo modulo-gruppo--sezione"
          role="group"
          aria-labelledby={schoolTitleId}
        >
          <h3 className="sezione__titolo" id={schoolTitleId}>
            Scuola
          </h3>
          <TextField
            id={ids.schoolName}
            label="Nome della scuola"
            placeholder="Es. scuola Manzoni"
            maxLength={SCHOOL_NAME_MAX}
            autoComplete="off"
            value={form.schoolName}
            onChange={(event) => update("schoolName", event.target.value)}
          />
          <TextField
            id={ids.schoolClass}
            label="Classe"
            placeholder="Es. 4ª B"
            maxLength={CLASS_MAX}
            autoComplete="off"
            value={form.schoolClass}
            onChange={(event) => update("schoolClass", event.target.value)}
          />
          <FieldPair>
            <TimeField
              id={ids.starts}
              label="Entra alle"
              autoComplete="off"
              value={form.startsAt}
              error={errors["starts"]}
              onChange={(event) => update("startsAt", event.target.value)}
            />
            <TimeField
              id={ids.ends}
              label="Esce alle"
              autoComplete="off"
              value={form.endsAt}
              error={errors["ends"]}
              onChange={(event) => update("endsAt", event.target.value)}
            />
          </FieldPair>
          <SelectField
            id={ids.days}
            label="Giorni"
            value={form.days}
            onChange={(event) =>
              update("days", event.target.value === "6" ? "6" : "5")
            }
          >
            {DAYS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            id={ids.note}
            label="Nota sull'orario"
            placeholder="Es. mensa compresa"
            maxLength={NOTE_MAX}
            autoComplete="off"
            value={form.note}
            error={errors["note"]}
            onChange={(event) => update("note", event.target.value)}
          />
        </div>

        <div
          className="modulo-gruppo modulo-gruppo--sezione"
          role="group"
          aria-labelledby={teachersTitleId}
        >
          <h3 className="sezione__titolo" id={teachersTitleId}>
            Maestre
          </h3>
          {form.teachers.map((teacher, index) => (
            <div
              key={teacher.key}
              className="modulo-gruppo"
              role="group"
              aria-label={`Maestra ${index + 1}`}
            >
              <TextField
                id={teacherId(teacher.key, "nome")}
                label="Nome della maestra"
                placeholder="Es. maestra Bianchi"
                maxLength={TEACHER_NAME_MAX}
                autoComplete="off"
                value={teacher.name}
                error={errors[`t${teacher.key}-nome`]}
                onChange={(event) =>
                  updateTeacher(teacher.key, { name: event.target.value })
                }
              />
              <TextField
                id={teacherId(teacher.key, "materia")}
                label="Materia"
                placeholder="Es. italiano e storia"
                maxLength={SUBJECT_MAX}
                autoComplete="off"
                value={teacher.subject}
                onChange={(event) =>
                  updateTeacher(teacher.key, { subject: event.target.value })
                }
              />
              <TextField
                id={teacherId(teacher.key, "telefono")}
                label="Telefono"
                type="tel"
                inputMode="tel"
                placeholder="Es. 039 234 5678"
                maxLength={PHONE_MAX}
                autoComplete="off"
                value={teacher.phone}
                error={errors[`t${teacher.key}-telefono`]}
                onChange={(event) =>
                  updateTeacher(teacher.key, { phone: event.target.value })
                }
              />
              <Button
                variant="pericolo"
                onClick={() => removeTeacher(teacher.key)}
              >
                Togli questa maestra
              </Button>
            </div>
          ))}
          {full ? (
            <p className="campo__aiuto">
              Puoi aggiungere fino a {MAX_TEACHERS} maestre.
            </p>
          ) : (
            <button
              type="button"
              id={ids.add}
              className="btn-tratteggiato"
              onClick={addTeacher}
            >
              <Icon name="plus" />
              Aggiungi una maestra
            </button>
          )}
        </div>

        <div
          className="modulo-gruppo modulo-gruppo--sezione"
          role="group"
          aria-labelledby={sizesTitleId}
        >
          <h3 className="sezione__titolo" id={sizesTitleId}>
            Taglie
          </h3>
          <FieldPair className="campo-doppio--tre">
            <TextField
              id={ids.shoe}
              label="Scarpe"
              placeholder="Es. 33"
              maxLength={SIZE_MAX}
              autoComplete="off"
              value={form.shoe}
              onChange={(event) => update("shoe", event.target.value)}
            />
            <TextField
              id={ids.clothing}
              label="Vestiti"
              placeholder="Es. 9–10"
              maxLength={SIZE_MAX}
              autoComplete="off"
              value={form.clothing}
              onChange={(event) => update("clothing", event.target.value)}
            />
            <TextField
              id={ids.pajama}
              label="Pigiama"
              placeholder="Es. 140"
              maxLength={SIZE_MAX}
              autoComplete="off"
              value={form.pajama}
              onChange={(event) => update("pajama", event.target.value)}
            />
          </FieldPair>
        </div>

        {failure ? (
          <Alert
            variant="errore"
            icon={failure === "network" ? "wifi-off" : "circle-alert"}
            action={
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
            }
          >
            {MEMBER_FAILURE_TEXT[failure]}
          </Alert>
        ) : null}
      </form>
    </Sheet>
  );
}
