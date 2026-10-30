"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CasaFrame, type CasaSection } from "@/components/casa/CasaFrame";
import type { PersonFilterMember } from "@/components/casa/PersonFilter";
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
import { countOpen, groupTodos } from "./model";
import { TODO_HEADING, TodoColumn } from "./TodoColumn";
import { useTodos } from "./useTodos";

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
 * Casa is one page with three columns: `/casa/spesa` and `/casa/da-fare` draw
 * the same view and differ in which column is the open one (the only one on
 * mobile). Each column reads and writes its own list.
 */
export function CasaPage({
  nestName,
  current,
}: {
  nestName: string;
  current: Extract<CasaSection, "spesa" | "da-fare">;
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

  // Did the focus sit inside the offline alert ("Riprova") the last time it moved?
  const focusInAlert = useRef(false);
  useEffect(() => {
    const track = (event: FocusEvent) => {
      focusInAlert.current =
        event.target instanceof Element && !!event.target.closest(".avviso");
    };
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, []);
  const anyOffline = shopping.offline || todos.offline;
  useEffect(() => {
    // The alert is gone and "Riprova" with it: the focus goes to a heading of
    // the open column. While any column is still offline the alert stays and
    // so does the focus.
    if (anyOffline || !focusInAlert.current) return;
    focusInAlert.current = false;
    const root = rootRef.current;
    const selectors =
      current === "da-fare"
        ? [`section[aria-label="Da fare"] ${TODO_HEADING}`]
        : [COMMON_HEADING, TO_TAKE_HEADING];
    for (const selector of selectors) {
      const target = Array.from(
        root?.querySelectorAll<HTMLElement>(selector) ?? [],
      ).find((element) => element.getClientRects().length > 0);
      if (target) {
        target.focus();
        break;
      }
    }
  }, [anyOffline, current]);

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

  // The page fails when the list of the open section cannot be read (on
  // desktop Da fare only when Spesa fails too); otherwise the error shows in
  // the column of the list that failed.
  const pageFails =
    current === "spesa"
      ? shopping.status === "error"
      : todos.status === "error" && (!desktop || shopping.status === "error");
  if (pageFails) {
    return (
      <main
        id="contenuto"
        tabIndex={-1}
        ref={rootRef}
        className="pagina pagina-desktop"
      >
        <PageError onRetry={reloadPage} />
      </main>
    );
  }

  if (shopping.status === "loading" || todos.status === "loading") {
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
  return (
    <CasaFrame
      nestName={nestName}
      current={current}
      mainRef={rootRef}
      counts={{
        spesa: shopping.status === "ready" ? shoppingToTake : undefined,
        "da-fare": todos.status === "ready" ? open : undefined,
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
      columns={{
        spesa:
          shopping.status === "error"
            ? {
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
