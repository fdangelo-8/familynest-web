import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import type { IconName } from "@/components/ui/Icon/Icon";

/**
 * Text-only legal page (terms, privacy), without the app frame. Until
 * Francesco provides the text, it shows the "In arrivo" state.
 */
export function LegalPage({
  title,
  icon,
  soonText,
}: {
  title: string;
  icon: IconName;
  soonText: string;
}) {
  return (
    <main className="pagina pagina-desktop pagina-desktop--centrata">
      <div>
        <Button variant="link-secondario" href="/accesso" icon="arrow-left">
          Torna all&apos;accesso
        </Button>
      </div>
      <div className="intestazione">
        <p className="intestazione__sopra">FamilyNest</p>
        <h1 className="intestazione__titolo t-titolo-pagina">{title}</h1>
      </div>
      <EmptyState
        icon={icon}
        title="In arrivo"
        text={soonText}
        actions={null}
      />
    </main>
  );
}
