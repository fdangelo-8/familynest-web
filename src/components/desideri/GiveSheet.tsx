"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { TextField } from "@/components/ui/Field/Field";
import { useIsDesktop } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { GIVER_NAME_MAX, normalizeGiverName } from "@/lib/public-wishlist";

/** What the page answers to a try of «Lo regalo io» */
export type GiveResult =
  /** Done (the page closes the sheet itself) */
  | { kind: "done" }
  /** Said in an alert of the sheet, which stays open with the name written */
  | { kind: "alert"; text: string }
  /** Said under the field */
  | { kind: "name"; text: string };

const NAME_ERROR = "Scrivi il tuo nome, così i genitori sanno chi lo regala.";

/**
 * Sheet «Lo regalo io» (#33 §4; mobile: bottom sheet, from 1024 px: modal).
 * One field, the name, which can be the one left the last time in this
 * browser. The name is never in an address and the field has no `name`.
 */
export function GiveSheet({
  itemTitle,
  childName,
  initialName,
  onClose,
  onGive,
}: {
  itemTitle: string;
  childName: string;
  initialName: string;
  onClose: () => void;
  onGive: (name: string) => Promise<GiveResult>;
}) {
  const base = useId();
  const formId = `${base}-form`;
  const nameId = `${base}-nome`;
  const desktop = useIsDesktop();
  const busy = useRef(false);

  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | undefined>();
  const [alertText, setAlertText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function submit() {
    if (busy.current) return;
    setAlertText(null);

    const value = normalizeGiverName(name);
    if (value === "") {
      setNameError(NAME_ERROR);
      document.getElementById(nameId)?.focus();
      return;
    }
    setNameError(undefined);

    busy.current = true;
    setSaving(true);
    const result = await onGive(value);
    if (result.kind === "done") {
      // Stays «saving» until the sheet has left: no second request.
      setLeaving(true);
      return;
    }
    busy.current = false;
    setSaving(false);
    if (result.kind === "alert") {
      setAlertText(result.text);
    } else {
      setNameError(result.text);
      document.getElementById(nameId)?.focus();
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
      icon="gift"
      full={!desktop}
      loading={saving}
      data-testid="regalo-conferma"
    >
      Lo regalo io
    </Button>
  );
  const footer = desktop ? (
    <>
      <Button
        variant="link-secondario"
        inactive={saving}
        onClick={() => setLeaving(true)}
      >
        Annulla
      </Button>
      {primary}
    </>
  ) : (
    primary
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={itemTitle}
      footer={footer}
      locked={saving}
      closeRequested={leaving}
      data-testid="regalo-foglio"
    >
      <form
        id={formId}
        className="modulo-foglio"
        method="post"
        noValidate
        onSubmit={onSubmit}
      >
        <TextField
          id={nameId}
          label="Come ti chiami?"
          help={`Lo vedranno solo i genitori. ${childName} no.`}
          autoComplete="off"
          maxLength={GIVER_NAME_MAX}
          value={name}
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />
        {alertText ? <Alert variant="errore">{alertText}</Alert> : null}
      </form>
    </Sheet>
  );
}
