import { notFound } from "next/navigation";
import { requireNest } from "@/lib/nest-frame";

// Unknown addresses inside the app: session check first, then the 404 shown
// inside the frame by (app)/not-found.tsx.
export default async function UnknownPage() {
  await requireNest();
  notFound();
}
