import { SearchOverlay } from "@/components/ricerca/SearchEntry";
import { requireNest } from "@/lib/nest-frame";

/**
 * `/ricerca` opened directly (typed address, reload, link): the palette over
 * Today (from 1024 px), like `/aggiungi`. Under 1024 px the page of the search
 * is the page itself and this slot draws nothing.
 */
export default async function Page() {
  await requireNest();
  return <SearchOverlay direct />;
}
