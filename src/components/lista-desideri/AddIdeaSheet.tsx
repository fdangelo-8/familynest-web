"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { addWishlistIdea } from "@/app/(app)/figli/[id]/lista-desideri/actions";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { TextField } from "@/components/ui/Field/Field";
import { useIsDesktop } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import {
  IDEA_MAX,
  LINK_MAX,
  NOTE_MAX,
  isShopAddress,
  normalizeText,
} from "./model";

const TEXTS = {
  title: "Aggiungi un'idea",
  link: "Link del negozio",
  idea: "Oppure scrivi l'idea",
  ideaPlaceholder: "Es. corso di pattinaggio",
  note: "Nota per chi regala",
  noteHelp: "La vedono anche nonni e parenti.",
  submit: "Aggiungi alla lista",
  empty: "Incolla il link di un negozio o scrivi l'idea qui sotto.",
  invalidLink:
    "Questo non sembra un link. Copialo di nuovo dalla pagina del negozio.",
  unreadable:
    "Non riusciamo a leggere la pagina del negozio. Scrivi qui il nome dell'idea: la aggiungiamo con il link.",
  limit: "Puoi aggiungere fino a 50 idee.",
  network: "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.",
} as const;

type Failure = "network" | "server" | "limit";

/**
 * Sheet «Aggiungi un'idea» (#32 §5; mobile: bottom sheet, from 1024 px:
 * modal). Every opening starts from empty fields. The link is read by the
 * server action, which then writes the idea.
 */
export function AddIdeaSheet({
  childId,
  onClose,
  onAdded,
}: {
  childId: string;
  onClose: () => void;
  /** The idea is saved: the page reads the list again */
  onAdded: () => Promise<unknown>;
}) {
  const base = useId();
  const formId = `${base}-form`;
  const linkId = `${base}-link`;
  const ideaId = `${base}-idea`;
  const desktop = useIsDesktop();
  const busy = useRef(false);

  const [link, setLink] = useState("");
  const [idea, setIdea] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ link?: string; idea?: string }>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function submit() {
    if (busy.current) return;
    setFailure(null);

    const linkText = normalizeText(link);
    const ideaText = normalizeText(idea);
    if (linkText === "" && ideaText === "") {
      setErrors({ link: TEXTS.empty });
      document.getElementById(linkId)?.focus();
      return;
    }
    if (linkText !== "" && !isShopAddress(linkText)) {
      setErrors({ link: TEXTS.invalidLink });
      document.getElementById(linkId)?.focus();
      return;
    }
    setErrors({});

    busy.current = true;
    setSaving(true);
    let result: Awaited<ReturnType<typeof addWishlistIdea>>;
    try {
      result = await addWishlistIdea({
        childId,
        link: linkText,
        idea: ideaText,
        note: normalizeText(note),
      });
    } catch {
      result = { ok: false, reason: "network" };
    }

    if (result.ok) {
      await onAdded();
      // Stays «saving» until the sheet has left: no second request.
      setLeaving(true);
      return;
    }

    busy.current = false;
    setSaving(false);
    if (result.reason === "unreadable") {
      setErrors({ idea: TEXTS.unreadable });
      document.getElementById(ideaId)?.focus();
    } else if (result.reason === "empty") {
      setErrors({ link: TEXTS.empty });
      document.getElementById(linkId)?.focus();
    } else if (result.reason === "invalid-link") {
      setErrors({ link: TEXTS.invalidLink });
      document.getElementById(linkId)?.focus();
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
      icon="plus"
      full={!desktop}
      loading={saving}
      data-testid="idea-aggiungi"
    >
      {TEXTS.submit}
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
      title={TEXTS.title}
      footer={footer}
      locked={saving}
      closeRequested={leaving}
      data-testid="idea-foglio"
    >
      <form
        id={formId}
        className="modulo-foglio"
        method="post"
        noValidate
        onSubmit={onSubmit}
      >
        <TextField
          id={linkId}
          label={TEXTS.link}
          type="url"
          inputMode="url"
          autoComplete="off"
          maxLength={LINK_MAX}
          value={link}
          error={errors.link}
          onChange={(event) => setLink(event.target.value)}
        />
        <TextField
          id={ideaId}
          label={TEXTS.idea}
          placeholder={TEXTS.ideaPlaceholder}
          autoComplete="off"
          maxLength={IDEA_MAX}
          value={idea}
          error={errors.idea}
          onChange={(event) => setIdea(event.target.value)}
        />
        <TextField
          label={TEXTS.note}
          help={TEXTS.noteHelp}
          autoComplete="off"
          maxLength={NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {failure ? <Alert variant="errore">{TEXTS[failure]}</Alert> : null}
      </form>
    </Sheet>
  );
}
