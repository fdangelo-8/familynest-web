import { Icon } from "@/components/ui/Icon/Icon";

/**
 * Label of the calendar an event was imported from («Google», «Outlook»),
 * as in the mockup: `briefcase` icon and the name (issue #34, §13). The
 * database says the provider only to the author, so the others never get a
 * label; without one nothing is drawn.
 */
export function SourceLabel({ label }: { label?: string | null }) {
  if (!label) return null;
  return (
    <span className="etichetta etichetta--piccola">
      <Icon name="briefcase" size="s" />
      {label}
    </span>
  );
}
