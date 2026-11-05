import { requireNest } from "@/lib/nest-frame";

/**
 * `/ricerca` opened directly (typed address, reload, link): the search over
 * the page of the address, Today for the page below (#40), like `/aggiungi`.
 *
 * The content comes with the page of the search (#40); until then nothing is
 * drawn here.
 */
export default async function Page() {
  await requireNest();
  return null;
}
