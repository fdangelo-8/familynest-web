"use client";

import { cx } from "../cx";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";

export type PageErrorProps = {
  onRetry: () => void;
  title?: string;
  text?: string;
  className?: string;
  "data-testid"?: string;
};

/** Whole-page error (`.errore-pagina`) with a "Riprova" button. */
export function PageError({
  onRetry,
  title = "Questa pagina non si è caricata",
  text = "Controlla la connessione e riprova. Se il problema resta, torna a Oggi.",
  className,
  "data-testid": testId,
}: PageErrorProps) {
  return (
    <div
      className={cx("errore-pagina", className)}
      role="alert"
      data-testid={testId}
    >
      <span className="errore-pagina__icona">
        <Icon name="wifi-off" />
      </span>
      <h2 className="errore-pagina__titolo">{title}</h2>
      <p className="errore-pagina__testo">{text}</p>
      <Button variant="secondary" small icon="rotate-cw" onClick={onRetry}>
        Riprova
      </Button>
    </div>
  );
}
