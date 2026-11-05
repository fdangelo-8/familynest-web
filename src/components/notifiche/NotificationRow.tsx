import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import type { RowView } from "./model";

/** Id of the text of a row: «Fatto» and «Apri» are described by it. */
export function rowTextId(row: RowView): string {
  return `notifica-testo-${row.index}`;
}

/**
 * One notification (`li.riga-notifica`). The row is not clickable: the only
 * actions are its buttons. «Fatto» only for a thing to do not done yet.
 */
export function NotificationRow({
  row,
  isDone,
  isGone,
  isBusy,
  inactive,
  onDone,
}: {
  row: RowView;
  /** The thing to do is done (when the page opened, or by «Fatto» since) */
  isDone: boolean;
  /** The thing to do is not there any more: no buttons */
  isGone: boolean;
  /** «Fatto» is running */
  isBusy: boolean;
  /** Offline: «Fatto» stays but does nothing */
  inactive: boolean;
  onDone: () => void;
}) {
  const textId = rowTextId(row);
  const showDone = row.todo !== null && !isDone && !isGone;
  const showOpen = !isGone && (row.todo !== null || row.openHref !== null);

  return (
    <li
      className={cx("riga-notifica", row.isNew && "is-nuova")}
      data-riga={row.index}
      data-testid="notifica"
    >
      {row.lead.type === "avatar" ? (
        <Avatar
          name={row.lead.name}
          color={row.lead.color}
          size="m"
          nameShown
        />
      ) : (
        <span
          className={cx(
            "icona-riquadro",
            row.lead.together && "icona-riquadro--insieme",
          )}
        >
          <Icon name={row.lead.icon} />
        </span>
      )}
      <div>
        <p className="riga-notifica__testo" id={textId}>
          {row.isNew ? <VisuallyHidden>Nuova. </VisuallyHidden> : null}
          {row.parts.map((part, index) =>
            part.kind === "bold" ? (
              <b key={index}>{part.text}</b>
            ) : part.kind === "urgent" ? (
              <span key={index} className="t-allerta">
                {part.text}
              </span>
            ) : (
              part.text
            ),
          )}
        </p>
        {showDone || showOpen ? (
          <div className="riga-notifica__azioni">
            {showDone ? (
              <Button
                variant="primary"
                small
                loading={isBusy}
                inactive={inactive}
                onClick={onDone}
                aria-describedby={textId}
              >
                Fatto
              </Button>
            ) : null}
            {showOpen ? (
              <Button
                variant="secondary"
                small
                href={row.todo ? "/casa/da-fare" : (row.openHref ?? "")}
                aria-describedby={textId}
              >
                Apri
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <span className="riga-notifica__ora">{row.time}</span>
    </li>
  );
}
