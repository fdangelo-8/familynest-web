import { AddSheet } from "@/components/aggiungi/AddSheet";
import { readAddAddress } from "@/components/aggiungi/address";
import { requireNest } from "@/lib/nest-frame";

/** `/aggiungi` opened from inside the app: a sheet over the current page. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireNest();
  return <AddSheet {...readAddAddress(await searchParams)} />;
}
