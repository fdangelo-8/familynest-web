import type { AnchorHTMLAttributes } from "react";

// Stand-in for `next/link` in the browser harness: a plain anchor.
export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
