"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { editHref, rememberOpener } from "@/components/aggiungi/coordination";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { QuickAddField } from "@/components/ui/QuickAddField/QuickAddField";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import {
  groupTodos,
  isShownOpen,
  todoInfo,
  type Todo,
  type TodoMember,
} from "./model";
import type { Todos } from "./useTodos";

/** Marks the headings the focus can land on (`useTodos` and the page look for it). */
export const TODO_HEADING = '[data-focus="todo-heading"]';

function SectionHead({ title, info }: { title: string; info: string }) {
  return (
    <div className="sezione__testa">
      <h3 className="sezione__titolo" tabIndex={-1} data-focus="todo-heading">
        {title}
      </h3>
      <span className="sezione__info">{info}</span>
    </div>
  );
}

function Row({
  todo,
  info,
  assignee,
  onToggle,
  onEdit,
}: {
  todo: Todo;
  info: ReturnType<typeof todoInfo>;
  assignee: TodoMember | undefined;
  onToggle: (key: string) => void;
  /** Opens the sheet to edit it; absent while the thing is not saved yet */
  onEdit: (todo: Todo) => void;
}) {
  const done = todo.doneAt !== null;
  const avatar = assignee ? (
    <Avatar name={assignee.name} color={assignee.color} nameShown />
  ) : null;
  return (
    <li
      className={cx("riga-lista", done && "riga-lista--fatto")}
      data-item-key={todo.key}
      data-testid="da-fare-riga"
    >
      <Checkbox
        checked={done}
        onChange={() => onToggle(todo.key)}
        aria-label={
          done
            ? `Rimetti da fare: ${todo.title}`
            : `Segna come fatto: ${todo.title}`
        }
      />
      <span className="riga-lista__testo">
        {todo.id.startsWith("tmp-") ? (
          <span className="riga-lista__titolo">{todo.title}</span>
        ) : (
          <button
            type="button"
            className="riga-lista__titolo"
            data-edit-id={todo.id}
            aria-label={`Modifica: ${todo.title}`}
            onClick={() => onEdit(todo)}
          >
            {todo.title}
          </button>
        )}
        {info ? (
          <span
            className={cx(
              "riga-lista__info",
              info.urgent && "riga-lista__info--allerta",
            )}
          >
            {info.text}
          </span>
        ) : null}
        {assignee ? (
          <VisuallyHidden>, se ne occupa {assignee.name}</VisuallyHidden>
        ) : null}
      </span>
      {todo.isPrivate ? (
        <span className="riga-lista__valore">
          <span
            className="riga-lista__lucchetto"
            aria-hidden="true"
            data-testid="lucchetto"
          >
            <Icon name="lock" size="s" />
          </span>
          {avatar}
        </span>
      ) : (
        avatar
      )}
    </li>
  );
}

/**
 * What goes inside the «Da fare» column: the quick field (desktop only), then
 * «Questa settimana», «Più avanti» and «Fatti», or an empty state.
 */
export function TodoColumn({
  list,
  quick,
  onQuickChange,
  desktop,
}: {
  list: Todos;
  quick: string;
  onQuickChange: (value: string) => void;
  desktop: boolean;
}) {
  const router = useRouter();
  const { todos, members, settling, filter, meMemberId, now } = list;
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const groups = useMemo(
    () => groupTodos(todos, { settling, filter, meMemberId, now }),
    [todos, settling, filter, meMemberId, now],
  );
  const everything = useMemo(
    () => groupTodos(todos, { settling, filter: "all", meMemberId, now }),
    [todos, settling, meMemberId, now],
  );

  const isEmpty =
    everything.thisWeek.length +
      everything.later.length +
      everything.done.length ===
    0;
  const shownCount =
    groups.thisWeek.length + groups.later.length + groups.done.length;
  const filterName =
    filter === "me" ? null : (membersById.get(filter)?.name ?? "");

  const openEditor = (todo: Todo, group: string) => {
    rememberOpener({
      kind: "todos",
      id: todo.id,
      primary: `[data-edit-id="${CSS.escape(todo.id)}"]`,
      fallbacks: [
        `[data-group="${group}"] ${TODO_HEADING}`,
        '[data-focus="casa-title"]',
      ],
    });
    router.push(editHref("da-fare", todo.id));
  };

  const renderRows = (rows: Todo[], group: string) => (
    <ul className="scheda lista">
      {rows.map((todo) => {
        const shownOpen = isShownOpen(todo, settling);
        return (
          <Row
            key={todo.key}
            todo={todo}
            info={todoInfo(todo, { shownOpen, now, membersById })}
            assignee={
              todo.assigneeId ? membersById.get(todo.assigneeId) : undefined
            }
            onToggle={list.toggleTodo}
            onEdit={(item) => openEditor(item, group)}
          />
        );
      })}
    </ul>
  );

  let content;
  if (isEmpty) {
    content = (
      <EmptyState
        large
        title="Niente da fare, per ora"
        text="Le cose da fare della casa compaiono qui, con chi se ne occupa e per quando."
        actions={
          <Button href="/aggiungi?tipo=da-fare" full>
            Aggiungi una cosa da fare
          </Button>
        }
      />
    );
  } else if (shownCount === 0) {
    content = (
      <EmptyState
        icon="square-check"
        title={
          filterName === null
            ? "Niente da fare per te"
            : `Niente da fare per ${filterName}`
        }
        text={
          filterName === null
            ? "Qui compaiono le cose di cui ti occupi tu."
            : `Qui compaiono le cose di cui si occupa ${filterName}.`
        }
        actions={
          <Button
            variant="link"
            onClick={() => {
              list.requestFocus([
                '[data-testid="filtro-persona-mobile"] .chip',
                '[data-testid="filtro-persona-desktop"] .chip',
              ]);
              list.setFilter("all");
            }}
          >
            Mostra tutte le cose da fare
          </Button>
        }
      />
    );
  } else {
    content = (
      <>
        {groups.thisWeek.length > 0 ? (
          <section
            className="sezione"
            data-group="thisWeek"
            data-testid="da-fare-questa-settimana"
          >
            <SectionHead
              title="Questa settimana"
              info={String(groups.thisWeek.length)}
            />
            {renderRows(groups.thisWeek, "thisWeek")}
          </section>
        ) : null}
        {groups.later.length > 0 ? (
          <section
            className="sezione"
            data-group="later"
            data-testid="da-fare-piu-avanti"
          >
            <SectionHead
              title="Più avanti"
              info={String(groups.later.length)}
            />
            {renderRows(groups.later, "later")}
          </section>
        ) : null}
        {groups.done.length > 0 ? (
          <section
            className="sezione"
            data-group="done"
            data-testid="da-fare-fatti"
          >
            <SectionHead title="Fatti" info="ultimi 7 giorni" />
            {renderRows(groups.done, "done")}
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      {desktop ? (
        <QuickAddField
          label="Aggiungi una cosa da fare…"
          value={quick}
          onChange={onQuickChange}
          onSubmit={list.addTodo}
        />
      ) : null}
      {content}
    </>
  );
}
