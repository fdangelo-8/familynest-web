import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/** Shown inside the frame while the page loads: the side menu stays still. */
export default function Loading() {
  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <SkeletonGroup className="colonna">
          <Skeleton shape="titolo" />
          <Skeleton shape="grande" />
          <Skeleton shape="grande" />
        </SkeletonGroup>
      </div>
    </main>
  );
}
