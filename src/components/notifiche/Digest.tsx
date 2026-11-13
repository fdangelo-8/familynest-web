import Link from "next/link";
import { cx } from "@/components/ui/cx";
import type { DigestView } from "@/lib/digest";

/** A word longer than this goes to a new line inside the sentence. */
const LONG_WORD = 24;

/** The morning summary: the day in a sentence, with words that open the thing. */
export function Digest({ view }: { view: DigestView }) {
  return (
    <section
      className="scheda scheda--evidenza sintesi"
      aria-label={view.name}
      data-testid="sintesi"
    >
      <p className="sintesi__sopra">
        <span>{view.top}</span>
        <span>Sintesi</span>
      </p>
      <p className="sintesi__frase">
        {view.tokens.map((token, index) =>
          token.kind === "word" ? (
            <Link
              key={index}
              href={token.href}
              className={cx(
                "parola",
                token.together && "parola--insieme",
                token.text.length > LONG_WORD && "parola--a-capo",
              )}
            >
              {token.text}
            </Link>
          ) : (
            token.text
          ),
        )}
      </p>
    </section>
  );
}
