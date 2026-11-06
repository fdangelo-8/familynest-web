import { Icon } from "../ui/Icon/Icon";

/** «Più dettagli» (mobile) and «Tutti i dettagli» (desktop): opens the full form. */
export function DetailsButton({
  label,
  inactive,
  onOpen,
}: {
  label: string;
  /** A save is running: the button does nothing and keeps its look */
  inactive: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-link btn-link--secondario"
      aria-disabled={inactive || undefined}
      onClick={() => {
        if (!inactive) onOpen();
      }}
      data-testid="aggiungi-ingresso-details"
    >
      <Icon name="sliders-horizontal" size="s" />
      {label}
    </button>
  );
}
