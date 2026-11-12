"use client";

import type { FormEvent } from "react";
import { Alert } from "../ui/Alert/Alert";
import { Button } from "../ui/Button/Button";
import {
  EventFormFields,
  type AlsoOnRow,
} from "../evento-modulo/EventFormFields";
import {
  BASE_REPEAT_OPTIONS,
  endsOtherDayHint,
  visibilityHelp,
  type EventFormValues,
  type EventMember,
  type FormErrors,
} from "../evento-modulo/model";
import { ALSO_ON_READ_FAILED_TEXT, SAVE_FAILED_TEXT } from "./labels";

/**
 * Body of the sheet while «Nuovo impegno» is open: the same fields as
 * «Modifica impegno», in the mode «new». Nothing leaves the browser until the
 * button is pressed. The person who creates is the author: nothing is locked.
 */
export function NewEventForm({
  formId,
  idPrefix,
  members,
  meId,
  values,
  errors,
  saveFailed,
  saving,
  alsoOn,
  alsoOnReadError,
  onChange,
  onSubmit,
}: {
  formId: string;
  idPrefix: string;
  members: ReadonlyArray<EventMember>;
  meId: string;
  values: EventFormValues;
  errors: FormErrors;
  saveFailed: boolean;
  /** «Anche su …»: present only with a calendar in «Dove vanno i nuovi impegni» */
  alsoOn?: AlsoOnRow;
  /** The save is running: «Riprova» of the reading cannot be used */
  saving: boolean;
  /**
   * The reading of the calendar failed (#304): the notice goes after «Note»,
   * before «Non siamo riusciti a salvare». `round` changes at every new failure
   * so the notice is mounted again and read again.
   */
  alsoOnReadError?: { busy: boolean; round: number; onRetry: () => void };
  onChange: (patch: Partial<EventFormValues>) => void;
  onSubmit: () => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form
      id={formId}
      className="modulo-foglio"
      method="post"
      noValidate
      onSubmit={handleSubmit}
    >
      <EventFormFields
        idPrefix={idPrefix}
        members={members}
        meId={meId}
        values={values}
        onChange={onChange}
        errors={errors}
        repeatOptions={BASE_REPEAT_OPTIONS}
        endsHint={endsOtherDayHint(values, 0)}
        locks={{ visibility: false, people: false }}
        visibilityText={visibilityHelp(values.visibility, true, null)}
        peopleLockedText={null}
        alsoOn={alsoOn}
      />
      {alsoOnReadError ? (
        <Alert
          key={alsoOnReadError.round}
          variant="errore"
          data-testid="anche-su-lettura-errore"
          action={
            <Button
              variant="tenue"
              small
              loading={alsoOnReadError.busy}
              disabled={saving}
              onClick={alsoOnReadError.onRetry}
              data-testid="anche-su-lettura-riprova"
            >
              Riprova
            </Button>
          }
        >
          {ALSO_ON_READ_FAILED_TEXT}
        </Alert>
      ) : null}
      {saveFailed ? <Alert variant="errore">{SAVE_FAILED_TEXT}</Alert> : null}
    </form>
  );
}
