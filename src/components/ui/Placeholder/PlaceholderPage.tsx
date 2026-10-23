import Link from "next/link";
import type { ReactNode } from "react";
import { PLACEHOLDERS, type PlaceholderKey } from "@/lib/app-routes";
import { SettingsMenu } from "../AppFrame/SettingsMenu";
import { EmptyState } from "../EmptyState/EmptyState";
import { Lens } from "../Lens/Lens";

const WITH_LENS: ReadonlyArray<PlaceholderKey> = [
  "oggi",
  "aggiungi",
  "calendario",
];
const WITH_SETTINGS_MENU: ReadonlyArray<PlaceholderKey> = [
  "profilo",
  "calendari-collegati",
  "impostazioni",
  "membri",
];

/**
 * "In arrivo" page for sections that are not built yet. Each real page
 * replaces its placeholder and keeps the same route.
 */
export function PlaceholderPage({
  pageKey,
  extra,
}: {
  pageKey: PlaceholderKey;
  /** Optional content after the "In arrivo" state (e.g. the "Esci" button) */
  extra?: ReactNode;
}) {
  const def = PLACEHOLDERS[pageKey];
  const isCasa = pageKey === "casa";

  const content = (
    <div className="colonna" data-testid="pagina-segnaposto">
      {isCasa ? (
        // On mobile the h1 "Casa" is in the top bar: one visible h1 per width.
        <div className="intestazione-desktop">
          <h1 className="t-titolo-pagina">{def.title}</h1>
        </div>
      ) : (
        <div className="intestazione">
          <h1 className="intestazione__titolo t-titolo-pagina">{def.title}</h1>
        </div>
      )}
      {WITH_LENS.includes(pageKey) ? (
        // The lens lives in the page header on desktop; on mobile it is in the top bar.
        <div className="intestazione-desktop">
          <Lens />
        </div>
      ) : null}
      <EmptyState
        icon={def.icon}
        title="In arrivo"
        text={def.text}
        actions={
          def.backToToday ? <Link href="/oggi">Torna a Oggi</Link> : null
        }
      />
      {extra}
    </div>
  );

  if (WITH_SETTINGS_MENU.includes(pageKey)) {
    return (
      <main className="pagina pagina-desktop">
        <div className="colonne colonne--menu">
          <SettingsMenu />
          <div className="colonna">{content}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="pagina pagina-desktop pagina-desktop--centrata">
      {content}
    </main>
  );
}
