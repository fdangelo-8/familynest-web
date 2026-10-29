import Link from "next/link";

/**
 * "Vai al contenuto": first element reachable with Tab. Hidden until it has
 * the focus; moves the focus to the page's <main> (`id="contenuto"`).
 */
export function SkipLink() {
  return (
    <Link
      href="#contenuto"
      className="vai-al-contenuto btn-primary btn--piccolo"
    >
      Vai al contenuto
    </Link>
  );
}
