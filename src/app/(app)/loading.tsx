import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/** Shown inside the frame while a page loads: bars stay still. */
export default function Loading() {
  return (
    <main className="pagina pagina-desktop pagina-desktop--centrata">
      <div aria-live="polite">
        <SkeletonGroup className="colonna">
          <Skeleton shape="titolo" />
          <Skeleton shape="testo-corto" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      </div>
    </main>
  );
}
