"use client";

import type { FormEvent } from "react";
import { Alert } from "../ui/Alert/Alert";
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
import { SAVE_FAILED_TEXT } from "./labels";

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
  alsoOn,
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
      {saveFailed ? <Alert variant="errore">{SAVE_FAILED_TEXT}</Alert> : null}
    </form>
  );
}
