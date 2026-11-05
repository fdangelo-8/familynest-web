"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button/Button";
import { useIsDesktop } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/Sheet/Sheet";

/**
 * When the clipboard cannot be used (permission denied, browser without it)
 * the address is shown in a read-only field, already selected (#32 §6, rule 3;
 * designer §4).
 */
export function CopyLinkSheet({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const textId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const desktop = useIsDesktop();
  const [leaving, setLeaving] = useState(false);

  // The sheet puts the focus on the field when it opens; the address is
  // selected right after, so that it can be copied with one gesture.
  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Copia il link"
      aria-describedby={textId}
      closeRequested={leaving}
      footerEnd
      footer={
        <Button full={!desktop} onClick={() => setLeaving(true)}>
          Fatto
        </Button>
      }
      data-testid="lista-copia-link"
    >
      <p className="t-corpo t-secondario" id={textId}>
        Tieni premuto il link e copialo, poi mandalo a nonni e parenti.
      </p>
      <div className="campo">
        <input
          ref={inputRef}
          type="text"
          className="campo__input"
          aria-label="Link della lista"
          readOnly
          autoComplete="off"
          value={url}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
    </Sheet>
  );
}
