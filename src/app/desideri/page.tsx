import { notFound } from "next/navigation";

// `/desideri` without a code: nothing to show.
export default function Page() {
  notFound();
}
