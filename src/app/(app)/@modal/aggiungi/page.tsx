import { AddSheet } from "@/components/aggiungi/AddSheet";
import { requireNest } from "@/lib/nest-frame";

/** `/aggiungi` opened directly (typed address, reload, link): sheet over Today. */
export default async function Page() {
  await requireNest();
  return <AddSheet direct />;
}
