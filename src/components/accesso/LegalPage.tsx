import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";

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
        <Link href="/accesso" className="btn-link btn-link--secondario">
          <Icon name="arrow-left" />
          <span className="btn__testo">Torna all&apos;accesso</span>
        </Link>
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
