"use client";

import { useMemo, useRef, useState } from "react";
import { CasaFrame, type CasaSection } from "@/components/casa/CasaFrame";
import type { PersonFilterMember } from "@/components/casa/PersonFilter";
import { groupTodos, countOpen } from "@/components/casa-da-fare/model";
import { TODO_HEADING, TodoColumn } from "@/components/casa-da-fare/TodoColumn";
import { useTodos } from "@/components/casa-da-fare/useTodos";
import {
  DeadlinesColumn,
  useDeadlineViews,
} from "@/components/casa-scadenze/DeadlinesColumn";
import { urgentLabel } from "@/components/casa-scadenze/model";
import { useDeadlines } from "@/components/casa-scadenze/useDeadlines";
import {
  COMMON_HEADING,
  SpesaColumn,
  splitShopping,
  TO_TAKE_HEADING,
} from "@/components/casa-spesa/SpesaPage";
import { useShoppingList } from "@/components/casa-spesa/useShoppingList";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { useIsDesktop } from "@/components/ui/overlay";
import { PageError } from "@/components/ui/PageError/PageError";

function reloadPage() {
  window.location.reload();
}

/** One column could not be read: the other columns stay usable. */
function ColumnError({
  what,
  retrying,
  onRetry,
}: {
  what: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert
      variant="errore"
      action={
        <Button variant="link" onClick={onRetry} loading={retrying}>
          Riprova
        </Button>
      }
    >
      Non riusciamo a caricare {what}. Controlla la connessione e riprova.
    </Alert>
  );
}

/**
 * Casa is one page with three columns: `/casa/spesa`, `/casa/da-fare` and
 * `/casa/scadenze` draw the same view and differ in which column is the open
 * one (the only one on mobile). Each column reads and writes its own list.
 */
export function CasaPage({
  nestName,
  current,
}: {
  nestName: string;
  current: CasaSection;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [shoppingQuick, setShoppingQuick] = useState("");
  const [todoQuick, setTodoQuick] = useState("");
  const desktop = useIsDesktop();
  const shopping = useShoppingList({
    rootRef,
    onAddRejected: (name) => setShoppingQuick((value) => value || name),
  });
  const todos = useTodos({
    rootRef,
    onAddRejected: (title) => setTodoQuick((value) => value || title),
  });
  const deadlines = useDeadlines();
  const deadlineViews = useDeadlineViews(deadlines);

  // One live region for the page: it speaks what changed last.
  const [spoken, setSpoken] = useState({ shopping: "", todos: "", text: "" });
  if (
    spoken.shopping !== shopping.announcement ||
    spoken.todos !== todos.announcement
  ) {
    setSpoken({
      shopping: shopping.announcement,
      todos: todos.announcement,
      text:
        spoken.shopping !== shopping.announcement
          ? shopping.announcement
          : todos.announcement,
    });
  }

  const { members, meMemberId, settling, now } = todos;
  const shoppingToTake = useMemo(
    () => splitShopping(shopping.items, shopping.settling).toTake.length,
    [shopping.items, shopping.settling],
  );
  const filterMembers = useMemo(() => {
    const toFilterMember = (member: (typeof members)[number]) => ({
      id: member.id,
      name: member.name,
      color: member.color,
    });
    const me: PersonFilterMember | undefined = members
      .filter((member) => member.id === meMemberId)
      .map(toFilterMember)[0];
    const others = members
      .filter((member) => member.kind !== "pet" && member.id !== meMemberId)
      .map(toFilterMember);
    return { me, others };
  }, [members, meMemberId]);
  const nothingToShow = useMemo(() => {
    const all = groupTodos(todos.todos, {
      settling,
      filter: "all",
      meMemberId,
      now,
    });
    return all.thisWeek.length + all.later.length + all.done.length === 0;
  }, [todos.todos, settling, meMemberId, now]);

  // The page error replaces the whole page. Mobile: when the list of the open
  // section cannot be read. Desktop: only when no column can be read at all;
  // otherwise the error shows in the column of the list that failed.
  const failed = {
    spesa: shopping.status === "error",
    "da-fare": todos.status === "error",
    scadenze: deadlines.status === "error",
  };
  const pageFails = desktop
    ? failed.spesa && failed["da-fare"] && failed.scadenze
    : failed[current];
  if (pageFails) {
    // Scadenze on mobile has its own way out and reads only its list again.
    const ownRetry = current === "scadenze" && !desktop;
    return (
      <main
        id="contenuto"
        tabIndex={-1}
        ref={rootRef}
        className="pagina pagina-desktop"
      >
        <PageError
          onRetry={ownRetry ? deadlines.retry : reloadPage}
          retrying={ownRetry ? deadlines.retrying : false}
          exit={
            current === "scadenze"
              ? { label: "Torna a Oggi", href: "/oggi" }
              : undefined
          }
        />
      </main>
    );
  }

  if (
    shopping.status === "loading" ||
    todos.status === "loading" ||
    deadlines.status === "loading"
  ) {
    return (
      <CasaFrame
        nestName={nestName}
        current={current}
        mainRef={rootRef}
        loading
      />
    );
  }

  const open = countOpen(todos.todos);
  const urgentCount = deadlineViews.filter((view) => view.urgent).length;
  return (
    <CasaFrame
      nestName={nestName}
      current={current}
      mainRef={rootRef}
      counts={{
        spesa: shopping.status === "ready" ? shoppingToTake : undefined,
        "da-fare": todos.status === "ready" ? open : undefined,
        scadenze:
          deadlines.status === "ready" ? deadlineViews.length : undefined,
      }}
      // On mobile an empty list shows no chips; on desktop they stay in the header.
      filter={
        todos.status === "ready" && (desktop || !nothingToShow)
          ? {
              me: filterMembers.me,
              others: filterMembers.others,
              value: todos.filter,
              onChange: todos.setFilter,
            }
          : undefined
      }
      // On mobile the chips are for the cose da fare only.
      hideFilterOnMobile={current !== "da-fare"}
      columns={{
        spesa:
          shopping.status === "error"
            ? {
                failed: true,
                children: (
                  <ColumnError
                    what="la spesa"
                    retrying={shopping.retrying}
                    onRetry={shopping.retry}
                  />
                ),
              }
            : {
                offline: {
                  active: shopping.offline,
                  retrying: shopping.retrying,
                  onRetry: shopping.retry,
                },
                focusTargets: [COMMON_HEADING, TO_TAKE_HEADING],
                info:
                  shoppingToTake > 0
                    ? `${shoppingToTake} da prendere`
                    : undefined,
                children: (
                  <SpesaColumn
                    list={shopping}
                    quick={shoppingQuick}
                    onQuickChange={setShoppingQuick}
                  />
                ),
              },
        "da-fare":
          todos.status === "error"
            ? {
                failed: true,
                children: (
                  <ColumnError
                    what="le cose da fare"
                    retrying={todos.retrying}
                    onRetry={todos.retry}
                  />
                ),
              }
            : {
                offline: {
                  active: todos.offline,
                  retrying: todos.retrying,
                  onRetry: todos.retry,
                },
                focusTargets: [TODO_HEADING],
                info:
                  open > 0
                    ? `${open} ${open === 1 ? "aperto" : "aperti"}`
                    : undefined,
                children: (
                  <TodoColumn
                    list={todos}
                    quick={todoQuick}
                    onQuickChange={setTodoQuick}
                    desktop={desktop}
                  />
                ),
              },
        scadenze: {
          failed: deadlines.status === "error",
          info:
            deadlines.status === "ready" ? urgentLabel(urgentCount) : undefined,
          children: <DeadlinesColumn list={deadlines} views={deadlineViews} />,
        },
      }}
      after={
        <div
          className="visivamente-nascosto"
          aria-live="polite"
          data-testid="spesa-annuncio"
        >
          {spoken.text}
        </div>
      }
    />
  );
}
