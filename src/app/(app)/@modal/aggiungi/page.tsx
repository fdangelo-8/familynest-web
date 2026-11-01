import { AddSheet } from "@/components/aggiungi/AddSheet";
import { readAddAddress } from "@/components/aggiungi/address";
import { requireNest } from "@/lib/nest-frame";

/** `/aggiungi` opened directly (typed address, reload, link): sheet over Today. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireNest();
  return <AddSheet direct {...readAddAddress(await searchParams)} />;
}
