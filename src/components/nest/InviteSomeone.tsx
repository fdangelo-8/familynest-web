"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addAdultToNest } from "@/app/(app)/nest/actions";
import type { TakenColor } from "@/components/ui/ColorChoice/ColorChoice";
import { Icon } from "@/components/ui/Icon/Icon";
import {
  MemberSheet,
  type MemberSaveResult,
  type MemberValues,
} from "@/components/ui/MemberSheet/MemberSheet";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { FOCUS_INVITE_KEY } from "@/components/membri/texts";
import { HOUSEHOLD_FULL_MESSAGE } from "@/lib/household-limits";

/**
 * "Invita qualcuno" (administrators only): opens the sheet with name and
 * colour and adds the adult, then opens the page of the new member (#18),
 * where the invitation is sent.
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
  const savedId = useRef<string | null>(null);

  async function save(values: MemberValues): Promise<MemberSaveResult> {
    const result = await addAdultToNest(values.name, values.color);
    savedId.current = result.ok ? result.memberId : null;
    return result;
  }

  function saved(values: MemberValues) {
    setAnnouncement(`${values.name} è nel Nest.`);
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
        onClose={() => {
          setOpen(false);
          const memberId = savedId.current;
          savedId.current = null;
          if (memberId) {
            // The new page puts the focus on «Manda l'invito».
            try {
              sessionStorage.setItem(FOCUS_INVITE_KEY, memberId);
            } catch {
              // No storage: the focus stays where the browser puts it.
            }
            router.push(`/membri/${memberId}`);
            return;
          }
          // Reads the page again on every close: after saving, the new row and
          // count; after a full Nest (or a colour taken), the real members.
          router.refresh();
          buttonRef.current?.focus();
        }}
        onSave={save}
        onSaved={saved}
      />
    </>
  );
}
