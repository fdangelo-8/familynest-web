import { requireNest } from "@/lib/nest-frame";

/**
 * `/ricerca` opened from inside the app (#40): the search over the current
 * page (a palette on desktop, a full page on mobile). The page below stays
 * where it is: `useFramePathname` keeps its address for the frame.
 *
 * The content comes with the page of the search (#40); until then nothing is
 * drawn here and the page below is left as it is.
 */
export default async function Page() {
  await requireNest();
  return null;
}
