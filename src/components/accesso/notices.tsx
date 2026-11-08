"use client";

import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { List, ListRow } from "@/components/ui/List/List";

/** Network or server problem: «Riprova» repeats the same request. */
export function NetworkNotice({
  text,
  onRetry,
}: {
  text: string;
  onRetry: () => void;
}) {
  return (
    <Alert
      variant="errore"
      role="alert"
      icon="wifi-off"
      action={
        <Button variant="link" onClick={onRetry}>
          Riprova
        </Button>
      }
    >
      {text}
    </Alert>
  );
}

/** Too many requests: informative, never a technical error. */
export function LimitNotice({ text }: { text: string }) {
  return (
    <Alert variant="info" role="status" icon="clock">
      {text}
    </Alert>
  );
}

export type HintRow = {
  icon: IconName;
  title: string;
  info: string;
};

/** Card of non-clickable rows under «Controlla la posta» and «Ti abbiamo scritto». */
export function HintList({ rows }: { rows: ReadonlyArray<HintRow> }) {
  return (
    <List className="scheda">
      {rows.map((row) => (
        <ListRow key={row.title}>
          <span className="icona-riquadro">
            <Icon name={row.icon} />
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{row.title}</span>
            <span className="riga-lista__info">{row.info}</span>
          </span>
        </ListRow>
      ))}
    </List>
  );
}
