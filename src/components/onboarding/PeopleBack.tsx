import Link from "next/link";
import { Icon } from "@/components/ui/Icon/Icon";

const BACK_HREF = "/onboarding?cambia=1";

/** Arrow "Indietro" of the mobile head: back to step 1 with the answer shown. */
export function BackArrow() {
  return (
    <Link
      href={BACK_HREF}
      prefetch={false}
      className="btn-icona"
      aria-label="Indietro"
    >
      <Icon name="arrow-left" />
    </Link>
  );
}

/** Text link "Indietro" of the desktop footer. */
export function BackLink() {
  return (
    <Link
      href={BACK_HREF}
      prefetch={false}
      className="btn-link btn-link--secondario"
    >
      Indietro
    </Link>
  );
}
