import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/** The shape of the card and of the two buttons, while the page opens. */
export default function Loading() {
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      <div aria-live="polite">
        <SkeletonGroup>
          <Skeleton shape="grande" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      </div>
    </main>
  );
}
