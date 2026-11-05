import type { ReactNode } from "react";
import { Icon } from "../ui/Icon/Icon";
import type { FormEntry } from "./new-event";

/**
 * A row of the summary on the right of the desktop modal. When the full form
 * can be opened it is a button (name + value is its accessible name);
 * otherwise it stays plain text, as in the first step.
 */
export function OptionRow({
  entry,
  interactive,
  inactive,
  onOpen,
  children,
}: {
  entry: Exclude<FormEntry, "details">;
  interactive: boolean;
  /** A save is running: the row does nothing and keeps its look */
  inactive: boolean;
  onOpen: (entry: FormEntry) => void;
  children: ReactNode;
}) {
  if (!interactive) return <div className="riga-opzione">{children}</div>;
  return (
    <button
      type="button"
      className="riga-opzione"
      aria-disabled={inactive || undefined}
      onClick={() => {
        if (!inactive) onOpen(entry);
      }}
      data-testid={`aggiungi-ingresso-${entry}`}
    >
      {children}
    </button>
  );
}

/** «Più dettagli» (mobile) and «Tutti i dettagli» (desktop): opens the full form. */
export function DetailsButton({
  label,
  inactive,
  onOpen,
}: {
  label: string;
  inactive: boolean;
  onOpen: (entry: FormEntry) => void;
}) {
  return (
    <button
      type="button"
      className="btn-link btn-link--secondario"
      aria-disabled={inactive || undefined}
      onClick={() => {
        if (!inactive) onOpen("details");
      }}
      data-testid="aggiungi-ingresso-details"
    >
      <Icon name="sliders-horizontal" size="s" />
      {label}
    </button>
  );
}
