import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/**
 * The shape of the page while it loads (designer, §6.3): title, card and three
 * rows. Same in the server `loading.tsx` and while the browser reads the data.
 */
export function WishlistSkeleton() {
  return (
    <SkeletonGroup aria-live="polite">
      <Skeleton shape="titolo" />
      <Skeleton shape="scheda" />
      <Skeleton shape="riga" />
      <Skeleton shape="riga" />
      <Skeleton shape="riga" />
    </SkeletonGroup>
  );
}
