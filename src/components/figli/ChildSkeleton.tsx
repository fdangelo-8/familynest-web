import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";

/**
 * The shape of the profile while it loads (mockup 21, «caricamento»): circle,
 * title, card and two rows. Same in the server `loading.tsx` and while the
 * browser reads the data.
 */
export function ChildSkeleton() {
  return (
    <SkeletonGroup aria-live="polite">
      <Skeleton shape="cerchio" />
      <Skeleton shape="titolo" />
      <Skeleton shape="scheda" />
      <Skeleton shape="riga" />
      <Skeleton shape="riga" />
    </SkeletonGroup>
  );
}
