"use client";

import { cx } from "../cx";
import { Button } from "../Button/Button";
import { Icon, type IconName } from "../Icon/Icon";

export type PageErrorProps = {
  onRetry: () => void;
  title?: string;
  text?: string;
  /** Icon in the circle (default `wifi-off`) */
  icon?: IconName;
  /** Heading level of the title: 1 when the error replaces the whole page, 2 (default) when the page already has an h1 */
  headingLevel?: 1 | 2;
  /** The retry is running: spinner in the button */
  retrying?: boolean;
  /** Optional way out shown under "Riprova" (link with text and address) */
  exit?: { label: string; href: string };
  className?: string;
  "data-testid"?: string;
};

/** Whole-page error (`.errore-pagina`) with a "Riprova" button. */
export function PageError({
  onRetry,
  title = "Questa pagina non si è caricata",
  text = "Controlla la connessione e riprova. Se il problema resta, torna a Oggi.",
  icon = "wifi-off",
  headingLevel = 2,
  retrying = false,
  exit,
  className,
  "data-testid": testId,
}: PageErrorProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div
      className={cx("errore-pagina", className)}
      role="alert"
      data-testid={testId}
    >
      <span className="errore-pagina__icona">
        <Icon name={icon} />
      </span>
      <Heading className="errore-pagina__titolo">{title}</Heading>
      <p className="errore-pagina__testo">{text}</p>
      <Button
        variant="secondary"
        small
        icon="rotate-cw"
        loading={retrying}
        onClick={onRetry}
      >
        Riprova
      </Button>
      {exit ? (
        <Button variant="link" href={exit.href}>
          {exit.label}
        </Button>
      ) : null}
    </div>
  );
}
