"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { TextField } from "@/components/ui/Field/Field";
import { useIsDesktop } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { deleteWishlistIdea, updateWishlistIdea } from "./api";
import { IDEA_MAX, NOTE_MAX, normalizeText, type WishItem } from "./model";

const TEXTS = {
  title: "Modifica l'idea",
  name: "Nome dell'idea",
  nameError: "Scrivi il nome dell'idea per salvarla.",
  note: "Nota per chi regala",
  noteHelp: "La vedono anche nonni e parenti.",
  save: "Salva le modifiche",
  remove: "Elimina l'idea",
  openShop: "Apri il negozio",
  network: "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.",
  deleteError:
    "Non siamo riusciti a eliminare l'idea. Controlla la connessione e riprova.",
} as const;

/**
 * Sheet «Modifica l'idea» (#32 §7): title and note can change, the shop and
 * the link are only shown (to change the link the idea is removed and added
 * again). «Elimina l'idea» asks for a confirmation.
 */
export function EditIdeaSheet({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: WishItem;
  onClose: () => void;
  /** The change is saved (`changed` false: nothing was different) */
  onSaved: (changed: boolean) => Promise<unknown>;
  /** The idea is gone: the page reads the list again and moves the focus */
  onDeleted: (item: WishItem) => Promise<unknown>;
}) {
  const base = useId();
  const formId = `${base}-form`;
  const nameId = `${base}-nome`;
  const desktop = useIsDesktop();
  const busy = useRef(false);

  const [name, setName] = useState(item.title);
  const [note, setNote] = useState(item.note ?? "");
  const [nameError, setNameError] = useState<string | undefined>();
  const [failure, setFailure] = useState<"network" | "server" | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function submit() {
    if (busy.current) return;
    setFailure(null);

    const title = normalizeText(name);
    const noteText = normalizeText(note);
    if (title === "") {
      setNameError(TEXTS.nameError);
      document.getElementById(nameId)?.focus();
      return;
    }
    setNameError(undefined);

    // Nothing changed: the sheet closes, nothing is sent and nothing is said.
    if (title === item.title && noteText === (item.note ?? "")) {
      busy.current = true;
      await onSaved(false);
      setLeaving(true);
      return;
    }

    busy.current = true;
    setSaving(true);
    const result = await updateWishlistIdea(item.id, title, noteText);
    if (result.ok) {
      await onSaved(true);
      // Stays «saving» until the sheet has left: no second request.
      setLeaving(true);
      return;
    }
    busy.current = false;
    setSaving(false);
    setFailure(result.reason);
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const save = (
    <Button
      type="submit"
      form={formId}
      full={!desktop}
      loading={saving}
      data-testid="idea-salva"
    >
      {TEXTS.save}
    </Button>
  );
  const remove = (
    <Button
      variant="pericolo"
      inactive={saving}
      aria-haspopup="dialog"
      onClick={() => setConfirming(true)}
      data-testid="idea-elimina"
    >
      {TEXTS.remove}
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

  const shop = item.shopName;
  const taken = item.giverName;

  return (
    <>
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
          {taken ? <Alert variant="info">La regala {taken}.</Alert> : null}
          <TextField
            id={nameId}
            label={TEXTS.name}
            autoComplete="off"
            maxLength={IDEA_MAX}
            value={name}
            error={nameError}
            onChange={(event) => setName(event.target.value)}
          />
          {shop || item.url ? (
            <p className="t-corpo t-secondario">
              {shop}
              {item.url ? (
                <>
                  {shop ? " · " : null}
                  <a
                    className="btn-link btn-link--secondario"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {TEXTS.openShop}
                    <VisuallyHidden>
                      , si apre in una nuova scheda
                    </VisuallyHidden>
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
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
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        aboveSheet
        title={`Eliminare «${item.title}»?`}
        text={
          taken
            ? `Sparisce anche dalla pagina condivisa. ${taken} aveva detto che la regalava.`
            : "Sparisce anche dalla pagina condivisa."
        }
        errorText={TEXTS.deleteError}
        actions={[
          {
            label: TEXTS.remove,
            variant: "pericolo-pieno",
            onClick: async () => {
              const result = await deleteWishlistIdea(item.id);
              if (!result.ok) return false;
              await onDeleted(item);
              setLeaving(true);
              return undefined;
            },
          },
        ]}
      />
    </>
  );
}
