import { AddSheet } from "@/components/aggiungi/AddSheet";
import { requireNest } from "@/lib/nest-frame";

/** `/aggiungi` opened from inside the app: a sheet over the current page. */
export default async function Page() {
  await requireNest();
  return <AddSheet />;
}
