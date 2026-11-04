import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/** Shown inside the frame while «Il tuo profilo» loads: the side menu stays still. */
export default function Loading() {
  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <SkeletonGroup className="colonna">
          <Skeleton shape="cerchio" />
          <Skeleton shape="titolo" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      </div>
    </main>
  );
}
