"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addAdultToNest } from "@/app/(app)/nest/actions";
import type { TakenColor } from "@/components/ui/ColorChoice/ColorChoice";
import { Icon } from "@/components/ui/Icon/Icon";
import {
  INVITE_PROVISIONAL_INTRO,
  MemberSheet,
  type MemberSaveResult,
  type MemberValues,
} from "@/components/ui/MemberSheet/MemberSheet";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { HOUSEHOLD_FULL_MESSAGE } from "@/lib/household-limits";

/**
 * "Invita qualcuno" (administrators only): opens the sheet with name and
 * colour and adds the adult. Provisional until the member page (#18) exists.
 */
export function InviteSomeone({
  taken,
  full,
}: {
  taken: ReadonlyArray<TakenColor>;
  full: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function save(values: MemberValues): Promise<MemberSaveResult> {
    return addAdultToNest(values.name, values.color);
  }

  function saved(values: MemberValues) {
    setAnnouncement(`${values.name} è nel Nest.`);
    // Reads the list again: the new row and the new count come from the server.
    router.refresh();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn-tratteggiato"
        disabled={full}
        aria-describedby={full ? "invita-completo" : undefined}
        onClick={() => {
          setAnnouncement("");
          setOpen(true);
        }}
      >
        <Icon name="user-plus" />
        Invita qualcuno
      </button>
      {full ? (
        <p className="campo__aiuto" id="invita-completo">
          {HOUSEHOLD_FULL_MESSAGE}
        </p>
      ) : null}
      <div role="status">
        {announcement ? <VisuallyHidden>{announcement}</VisuallyHidden> : null}
      </div>
      <MemberSheet
        open={open}
        mode="invite"
        taken={taken}
        intro={INVITE_PROVISIONAL_INTRO}
        onClose={() => {
          setOpen(false);
          buttonRef.current?.focus();
        }}
        onSave={save}
        onSaved={saved}
      />
    </>
  );
}
