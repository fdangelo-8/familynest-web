import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { brandText, messages } from "@/lib/brand";

/**
 * Shown inside the frame while the page loads: the side menu stays still and
 * the head of the page is the real one (its texts are fixed).
 */
export default function Loading() {
  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <SkeletonGroup className="colonna">
          <div className="intestazione">
            <p className="intestazione__sopra">Impostazioni</p>
            <h1 className="intestazione__titolo t-titolo-pagina">
              Calendari collegati
            </h1>
            <p className="intestazione__sotto">
              {brandText(messages.calendariCollegati.intro)}
            </p>
          </div>
          <Skeleton shape="testo-corto" />
          <Skeleton shape="grande" />
          <Skeleton shape="testo-corto" />
          <Skeleton shape="grande" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      </div>
    </main>
  );
}
