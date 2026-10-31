"use client";

import { cx } from "../cx";
import { Button } from "../Button/Button";
import { Icon, type IconName } from "../Icon/Icon";

type PageErrorBase = {
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

export type PageErrorProps = PageErrorBase &
  (
    | { onRetry: () => void; action?: undefined }
    /** A link in place of "Riprova", for errors where retrying makes no sense */
    | {
        action: { label: string; href: string; icon?: IconName };
        onRetry?: undefined;
      }
  );

/** Whole-page error (`.errore-pagina`) with a "Riprova" button, or with a link given as `action`. */
export function PageError({
  onRetry,
  action,
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
      {action ? (
        <Button
          variant="secondary"
          small
          icon={action.icon ?? "rotate-cw"}
          href={action.href}
        >
          {action.label}
        </Button>
      ) : (
        <Button
          variant="secondary"
          small
          icon="rotate-cw"
          loading={retrying}
          onClick={onRetry}
        >
          Riprova
        </Button>
      )}
      {exit ? (
        <Button variant="link" href={exit.href}>
          {exit.label}
        </Button>
      ) : null}
    </div>
  );
}
