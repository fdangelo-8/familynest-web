import { SearchOverlay } from "@/components/ricerca/SearchEntry";
import { requireNest } from "@/lib/nest-frame";

/**
 * `/ricerca` opened from inside the app: the palette over the current page
 * (from 1024 px). The page below stays where it is: `useFramePathname` keeps
 * its address for the frame. Under 1024 px the search is loaded as a page.
 */
export default async function Page() {
  await requireNest();
  return <SearchOverlay direct={false} />;
}
