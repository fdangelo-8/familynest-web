"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { useIsDesktop } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import type { Instant } from "@/lib/datetime";
import {
  deleteDialogTitle,
  deleteToast,
  saveDialogTitle,
} from "@/lib/event-texts";
import type { EventOccurrence } from "@/lib/household-events";
import { createClient } from "@/lib/supabase/client";
import { EventFormFields, focusField } from "./EventFormFields";
import {
  ERROR_TEXTS,
  allDialogText,
  calendarHref,
  choiceDialogText,
  classifySave,
  deleteTextOf,
  dayTakenText,
  endDayOffset,
  endsOtherDayHint,
  escortRefusedText,
  firstErrorField,
  initialValues,
  isFirstOccurrence,
  locksFor,
  peopleLockedHelp,
  repeatOptions,
  validateForm,
  visibilityHelp,
  type EventFormValues,
  type EventMember,
  type FieldKey,
  type FormErrors,
} from "./model";
import {
  deleteEvent,
  saveEvent,
  type SaveOutcome,
  type SaveScope,
} from "./save";

const SAVE_FAILED =
  "Non riusciamo a salvare le modifiche. Controlla la connessione e riprova.";
const DELETE_FAILED =
  "Non riusciamo a eliminare l'impegno. Controlla la connessione e riprova.";

/** How long the delete dialog stays busy while the calendar opens. */
const NAVIGATION_WAIT_MS = 8000;

type Times = { start: Date; end: Date };

type DialogState =
  | { type: "choice"; text: string; times: Times }
  | { type: "all"; text: string; times: Times }
  | { type: "delete"; text: string };

export type EditEventSheetProps = {
  open: boolean;
  /** Runs after the sheet has left (X, Esc, veil, drag, or after saving) */
  onClose: () => void;
  occurrence: EventOccurrence;
  members: ReadonlyArray<EventMember>;
  /** Member id of the signed-in user */
  meId: string;
  now: Instant;
  /**
   * The change is saved. The page reads the occurrence again, updates the
   * address and shows the toast; the sheet leaves when this resolves.
   */
  onSaved: (saved: { id: string; day: string }) => Promise<void>;
  /** The event turned out to be gone (deleted by someone else) */
  onMissing: () => void;
};

/**
 * «Modifica impegno»: the full form in a sheet (mobile) or a modal (from
 * 1024 px), with the dialogs for saving a repeated event and for deleting.
 * The state starts again every time it opens.
 */
export function EditEventSheet(props: EditEventSheetProps) {
  if (!props.open) return null;
  return <EditEventSheetOpen {...props} />;
}

function EditEventSheetOpen({
  onClose,
  occurrence: openedOccurrence,
  members,
  meId,
  now,
  onSaved,
  onMissing,
}: EditEventSheetProps) {
  const base = useId();
  const formId = `${base}-modulo`;
  const router = useRouter();
  const { showToast } = useToast();
  const desktop = useIsDesktop();
  // What the sheet works on stays as it was when it opened, even if the page
  // reads the occurrence again while the sheet is leaving.
  const [occurrence] = useState(openedOccurrence);
  const [initial] = useState(() => initialValues(openedOccurrence));
  const [offset] = useState(() => endDayOffset(openedOccurrence));
  const [values, setValues] = useState<EventFormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [alertText, setAlertText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const busy = useRef(false);
  // Field that gets the focus when the dialog above the form has left.
  const pendingFocus = useRef<FieldKey | null>(null);
  const client = useRef<ReturnType<typeof createClient> | null>(null);
  const supabase = () => {
    client.current ??= createClient();
    return client.current;
  };

  const locks = locksFor(occurrence, meId);
  const author = members.find((m) => m.id === occurrence.authorMemberId);
  const isAuthor = occurrence.authorMemberId === meId;
  const authorName = author?.name ?? null;

  const change = (patch: Partial<EventFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  /** Tells what a save outcome means for the form. */
  async function settle(
    outcome: SaveOutcome,
  ): Promise<"done" | "field" | "failed"> {
    if (outcome.ok) {
      await onSaved({ id: outcome.id, day: outcome.day });
      setLeaving(true);
      return "done";
    }
    const fail = (key: FieldKey, text: string) => {
      setErrors({ [key]: text });
      pendingFocus.current = key;
      return "field" as const;
    };
    switch (outcome.reason) {
      case "missing":
        onMissing();
        return "done";
      case "day-taken":
        return fail("day", dayTakenText(values.day, now));
      case "duration":
        return fail("repeat", ERROR_TEXTS.duration);
      case "escort": {
        const escort = members.find((m) => m.id === values.escortId);
        return fail("escort", escortRefusedText(escort?.name ?? ""));
      }
      default:
        return "failed";
    }
  }

  async function saveNow(scope: SaveScope, times: Times) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    const outcome = await saveEvent(
      supabase(),
      occurrence,
      values,
      times,
      scope,
    );
    const result = await settle(outcome);
    if (result === "done") return; // stays busy until the sheet has left
    busy.current = false;
    setSaving(false);
    if (result === "failed") setAlertText(SAVE_FAILED);
    else if (pendingFocus.current) {
      focusField(base, pendingFocus.current);
      pendingFocus.current = null;
    }
  }

  async function saveInDialog(scope: SaveScope, times: Times) {
    const outcome = await saveEvent(
      supabase(),
      occurrence,
      values,
      times,
      scope,
    );
    const result = await settle(outcome);
    return result === "failed" ? false : undefined;
  }

  async function deleteInDialog(scope: "this" | "following") {
    const result = await deleteEvent(supabase(), occurrence, scope);
    if (result === "missing") {
      onMissing();
      return undefined;
    }
    if (result === "failed") return false;
    const toastScope =
      occurrence.recurrence === "none"
        ? "all"
        : scope === "this"
          ? "one"
          : "following";
    showToast({
      ...deleteToast(
        toastScope,
        occurrence.title,
        occurrence.occurrenceDate,
        isFirstOccurrence(occurrence),
        now,
      ),
    });
    router.push(calendarHref(occurrence.startsAt));
    // The dialog stays busy until the calendar is there.
    await new Promise((resolve) =>
      window.setTimeout(resolve, NAVIGATION_WAIT_MS),
    );
    return undefined;
  }

  function submit() {
    if (busy.current) return;
    setAlertText(null);
    const { errors: found, times } = validateForm(values, offset);
    setErrors(found);
    const first = firstErrorField(found);
    if (first) {
      focusField(base, first);
      return;
    }
    if (!times) return;

    const kind = classifySave(occurrence, initial, values, members);
    if (kind.kind === "none") {
      setLeaving(true);
    } else if (kind.kind === "direct") {
      void saveNow("following", times);
    } else if (kind.kind === "choice") {
      setDialog({
        type: "choice",
        text: choiceDialogText(occurrence, values, now),
        times,
      });
    } else {
      setDialog({
        type: "all",
        text: allDialogText(occurrence, values, kind, now),
        times,
      });
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  // A field the dialog above the form asked to focus (day taken, escort not
  // allowed): the effect runs after the dialog has given the focus back to
  // its opener, so this focus is the last one.
  useEffect(() => {
    if (dialog !== null) return;
    const key = pendingFocus.current;
    if (key) {
      pendingFocus.current = null;
      focusField(base, key);
    }
  }, [dialog, base]);

  const save = (
    <Button
      type="submit"
      form={formId}
      full={!desktop}
      icon="check"
      loading={saving}
      data-testid="impegno-salva"
    >
      Salva le modifiche
    </Button>
  );
  const remove = (
    <Button
      variant="pericolo"
      inactive={saving}
      onClick={() =>
        setDialog({
          type: "delete",
          text: deleteTextOf(occurrence, members, meId, now),
        })
      }
      data-testid="impegno-elimina"
    >
      Elimina impegno
    </Button>
  );
  const footer = desktop ? (
    <>
      {remove}
      {save}
    </>
  ) : (
    <>
      {save}
      {remove}
    </>
  );

  const repeats = occurrence.recurrence !== "none";
  const dialogActions =
    dialog?.type === "choice"
      ? [
          {
            label: "Salva tutti i prossimi",
            variant: "secondary" as const,
            onClick: () => saveInDialog("following", dialog.times),
          },
          {
            label: "Salva solo questo",
            variant: "primary" as const,
            onClick: () => saveInDialog("this", dialog.times),
          },
        ]
      : dialog?.type === "all"
        ? [
            {
              label: "Salva tutti i prossimi",
              variant: "primary" as const,
              onClick: () => saveInDialog("following", dialog.times),
            },
          ]
        : repeats
          ? [
              {
                label: "Elimina tutti i prossimi",
                variant: "secondary" as const,
                onClick: () => deleteInDialog("following"),
              },
              {
                label: "Elimina solo questo",
                variant: "pericolo-pieno" as const,
                onClick: () => deleteInDialog("this"),
              },
            ]
          : [
              {
                label: "Elimina impegno",
                variant: "pericolo-pieno" as const,
                onClick: () => deleteInDialog("this"),
              },
            ];

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Modifica impegno"
        tall
        footer={footer}
        locked={saving || dialog !== null}
        closeRequested={leaving}
        data-testid="impegno-modulo"
      >
        <form
          id={formId}
          className="modulo-foglio"
          method="post"
          noValidate
          onSubmit={onSubmit}
        >
          <EventFormFields
            idPrefix={base}
            members={members}
            meId={meId}
            values={values}
            onChange={change}
            errors={errors}
            repeatOptions={repeatOptions(occurrence, now)}
            endsHint={endsOtherDayHint(values, offset)}
            locks={locks}
            visibilityText={visibilityHelp(
              values.visibility,
              isAuthor,
              authorName,
            )}
            peopleLockedText={peopleLockedHelp(authorName)}
          />
          {alertText ? (
            <Alert variant="errore" data-testid="impegno-errore">
              {alertText}
            </Alert>
          ) : null}
        </form>
      </Sheet>
      <ConfirmDialog
        open={dialog !== null}
        aboveSheet
        onClose={() => setDialog(null)}
        title={
          dialog?.type === "delete"
            ? deleteDialogTitle(occurrence.title)
            : saveDialogTitle(occurrence.title)
        }
        text={dialog?.text ?? ""}
        actions={dialogActions}
        errorText={dialog?.type === "delete" ? DELETE_FAILED : SAVE_FAILED}
        data-testid="impegno-dialogo"
      />
    </>
  );
}
