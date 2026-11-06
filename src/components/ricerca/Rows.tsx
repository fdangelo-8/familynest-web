"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { SourceLabel } from "@/components/calendario/SourceLabel";
import type { TitlePart } from "./highlight";
import type { RowModel } from "./model";
import type { SearchController } from "./useSearchController";

/** A title with the words looked for inside `mark.evidenzia`. */
function Title({ parts }: { parts: TitlePart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.mark ? (
          <mark className="evidenzia" key={index}>
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

function RowAvatar({
  row,
  ctrl,
}: {
  row: RowModel;
  ctrl: SearchController;
}): ReactNode {
  const person = row.avatarMemberId
    ? ctrl.peopleById.get(row.avatarMemberId)
    : undefined;
  return person ? (
    <Avatar name={person.name} color={person.color} nameShown />
  ) : null;
}

function Info({ row }: { row: RowModel }) {
  if (row.info === null && !row.sourceLabel) return null;
  return (
    <span
      className={cx(
        "riga-lista__info",
        row.urgent && "riga-lista__info--allerta",
      )}
    >
      <SourceLabel label={row.sourceLabel} />
      {row.sourceLabel && row.info ? " " : null}
      {row.info}
      {row.urgent && row.kind === "deadline" ? (
        <VisuallyHidden>, urgente</VisuallyHidden>
      ) : null}
    </span>
  );
}

/** Day or icon, title and information: the same on mobile and in the palette. */
function RowBody({ row, trailing }: { row: RowModel; trailing: ReactNode }) {
  return (
    <>
      {row.lead.type === "day" ? (
        <span className="riga-lista__ora">{row.lead.text}</span>
      ) : (
        <span className="icona-riquadro">
          <Icon name={row.lead.icon} />
        </span>
      )}
      <span className="riga-lista__testo">
        <span
          className={cx("riga-lista__titolo", row.masked && "t-secondario")}
        >
          <Title parts={row.title} />
          {row.locked ? (
            <>
              {" "}
              <Icon name="lock" size="s" />
              <VisuallyHidden>Visibile solo a te</VisuallyHidden>
            </>
          ) : null}
        </span>
        <Info row={row} />
      </span>
      {trailing}
    </>
  );
}

/** A row of the groups on mobile (inside `ul.scheda.lista`). */
export function PageRow({
  row,
  position,
  ctrl,
}: {
  row: RowModel;
  /** Place among the things to do, to find the box again */
  position: number;
  ctrl: SearchController;
}) {
  const avatar = <RowAvatar row={row} ctrl={ctrl} />;

  if (row.masked) {
    // «Occupato» of someone else: not a link, not a button, no focus.
    return (
      <li
        className="riga-lista"
        data-testid="ricerca-riga"
        data-kind={row.kind}
        data-masked="true"
      >
        <RowBody row={row} trailing={avatar} />
      </li>
    );
  }

  if (row.kind === "todo" && row.todoId !== null && row.href !== null) {
    const done = ctrl.doneIds.has(row.todoId);
    return (
      <li
        className={cx(
          "riga-lista",
          "riga-lista--modificabile",
          done && "riga-lista--fatto",
        )}
        data-testid="ricerca-riga"
        data-kind="todo"
        data-todo-position={position}
      >
        <Checkbox
          checked={done}
          onChange={() => void ctrl.toggleTodo(row, position)}
          aria-label={`Segna come fatto: ${row.titleText}`}
        />
        <span className="riga-lista__testo">
          <Link
            href={row.href}
            className="riga-lista__titolo"
            onClick={(event) => ctrl.onRowClick(row, event)}
          >
            <Title parts={row.title} />
          </Link>
          <Info row={row} />
        </span>
        {avatar}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={row.href ?? "/oggi"}
        className="riga-lista riga-lista--cliccabile"
        onClick={(event) => ctrl.onRowClick(row, event)}
        data-testid="ricerca-riga"
        data-kind={row.kind}
      >
        <RowBody row={row} trailing={avatar} />
      </Link>
    </li>
  );
}

/** A row of the palette (an option of the list the arrows move in). */
export function PaletteRow({
  row,
  ctrl,
}: {
  row: RowModel;
  ctrl: SearchController;
}) {
  const selected = ctrl.activeKey === row.key;
  const avatar = <RowAvatar row={row} ctrl={ctrl} />;

  if (row.masked) {
    return (
      <li role="presentation">
        <div
          className="riga-lista"
          role="option"
          aria-selected="false"
          aria-disabled="true"
          id={ctrl.itemId(row.key)}
          data-testid="ricerca-riga"
          data-kind={row.kind}
          data-masked="true"
        >
          <RowBody row={row} trailing={avatar} />
        </div>
      </li>
    );
  }

  return (
    <li role="presentation">
      <Link
        href={row.href ?? "/oggi"}
        className={cx(
          "riga-lista",
          "riga-lista--cliccabile",
          selected && "is-selezionata",
        )}
        role="option"
        aria-selected={selected}
        id={ctrl.itemId(row.key)}
        tabIndex={-1}
        onClick={(event) => ctrl.onRowClick(row, event)}
        onMouseMove={() => {
          if (!selected) ctrl.select(row.key);
        }}
        data-testid="ricerca-riga"
        data-kind={row.kind}
      >
        <RowBody
          row={row}
          trailing={
            selected ? (
              <kbd className="kbd" aria-hidden="true">
                ↵
              </kbd>
            ) : (
              avatar
            )
          }
        />
      </Link>
    </li>
  );
}
