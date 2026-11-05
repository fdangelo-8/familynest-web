import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/**
 * The shape of the public page while it loads (designer, §5.6): on a phone
 * circle, title, text and three rows; from 1024 px the same shapes on the left
 * and three cards on the right. Only one of the two is visible.
 */
export function PublicSkeleton() {
  return (
    <>
      <SkeletonGroup className="pubblica-solo-mobile" aria-live="polite">
        <Skeleton shape="cerchio" />
        <Skeleton shape="titolo" />
        <Skeleton shape="testo" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
      </SkeletonGroup>
      <SkeletonGroup className="pubblica-solo-desktop" aria-live="polite">
        <div className="colonne colonne--menu">
          <div className="colonna">
            <Skeleton shape="cerchio" />
            <Skeleton shape="titolo" />
            <Skeleton shape="testo" />
          </div>
          <div className="colonna">
            <div className="colonne colonne--tre">
              <Skeleton shape="scheda" />
              <Skeleton shape="scheda" />
              <Skeleton shape="scheda" />
            </div>
          </div>
        </div>
      </SkeletonGroup>
    </>
  );
}
