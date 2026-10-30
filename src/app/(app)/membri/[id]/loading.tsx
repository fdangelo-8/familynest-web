import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/** Shown inside the frame while the member page loads: the side menu stays still. */
export default function Loading() {
  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <SkeletonGroup className="colonna">
          <div className="profilo-testa profilo-testa--riga">
            <Skeleton shape="cerchio" />
            <div className="intestazione">
              <Skeleton shape="titolo" />
              <Skeleton shape="testo-corto" />
            </div>
          </div>
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      </div>
    </main>
  );
}
