"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { PageError } from "@/components/ui/PageError/PageError";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { formatTime } from "@/lib/datetime";
import { completeTodo, reopenTodo } from "./data";
import { Digest } from "./Digest";
import { buildSections, type RowView } from "./model";
import { NotificationRow } from "./NotificationRow";
import { NotificationsLoading } from "./NotificationsLoading";
import { PageHeader } from "./PageHeader";
import {
  DIGEST_ERROR,
  EMPTY_TEXT,
  EMPTY_TITLE,
  MARK_ALL_FAILURE,
  MARK_ALL_LABEL,
  TODO_GONE,
  UNDO_FAILURE,
  doneFailureText,
  newLabel,
  offlineText,
  type Failure,
} from "./texts";
import { useNotifications } from "./useNotifications";

/** The notice under the card of a section («Fatto» did not work). */
type SectionNotice = { text: string; icon: "wifi-off" | "circle-alert" };

type FocusRequest =
  | {
      index: number;
      target: "done" | "open";
    }
  | { sectionKey: string; target: "notice" };

function failureIcon(failure: Failure): SectionNotice["icon"] {
  return failure === "network" ? "wifi-off" : "circle-alert";
}

/** `/notifiche`: the summary of the morning and the notifications of the last 30 days. */
export function NotificationsPage() {
  const {
    status,
    loaded,
    newIds,
    online,
    retry,
    retrying,
    retryDigest,
    digestRetrying,
    markAll,
    marking,
    allMarked,
    markFailure,
    announcement,
    getClient,
  } = useNotifications();
  const { showToast } = useToast();
  const mainRef = useRef<HTMLElement>(null);

  // Things to do marked done / found gone since the page opened.
  const [doneTodos, setDoneTodos] = useState<ReadonlySet<string>>(new Set());
  const [goneTodos, setGoneTodos] = useState<ReadonlySet<string>>(new Set());
  const [busyTodos, setBusyTodos] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef<Set<string>>(new Set());
  const [notices, setNotices] = useState<Record<string, SectionNotice>>({});
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const sections = useMemo(
    () =>
      loaded
        ? buildSections({
            notifications: loaded.notifications,
            members: loaded.context.members,
            meId: loaded.context.meId,
            newIds,
            now: loaded.now,
          })
        : [],
    [loaded, newIds],
  );

  // Moves the focus after a change (the element it was on may be gone).
  useEffect(() => {
    if (!focusRequest || !mainRef.current) return;
    const root = mainRef.current;
    let element: HTMLElement | null = null;
    if (focusRequest.target === "notice") {
      element = root.querySelector<HTMLElement>(
        `[data-sezione="${CSS.escape(focusRequest.sectionKey)}"] .avviso`,
      );
      // The notice is the shared `Alert`: it takes the focus without being a tab stop.
      element?.setAttribute("tabindex", "-1");
    } else {
      const row = root.querySelector(`[data-riga="${focusRequest.index}"]`);
      element =
        focusRequest.target === "done"
          ? (row?.querySelector<HTMLElement>("button") ?? null)
          : (row?.querySelector<HTMLElement>("a") ?? null);
    }
    element?.focus();
    setFocusRequest(null);
  }, [focusRequest]);

  const setNotice = useCallback(
    (sectionKey: string, notice: SectionNotice | null) => {
      setNotices((current) => {
        const next = { ...current };
        if (notice) next[sectionKey] = notice;
        else delete next[sectionKey];
        return next;
      });
    },
    [],
  );

  const toggle = (
    setter: typeof setDoneTodos,
    id: string,
    present: boolean,
  ): void => {
    setter((current) => {
      const next = new Set(current);
      if (present) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const undo = useCallback(
    async (row: RowView, sectionKey: string) => {
      if (!row.todo) return;
      const failure = await reopenTodo(getClient(), row.todo.id);
      if (failure) {
        setNotice(sectionKey, {
          text: UNDO_FAILURE[failure],
          icon: failureIcon(failure),
        });
        return;
      }
      toggle(setDoneTodos, row.todo.id, false);
      setFocusRequest({ index: row.index, target: "done" });
    },
    [getClient, setNotice],
  );

  /** «Fatto». A second tap while it runs does nothing. */
  const markDone = async (row: RowView, sectionKey: string) => {
    const todo = row.todo;
    if (!todo || !online || inFlight.current.has(todo.id)) return;
    inFlight.current.add(todo.id);
    toggle(setBusyTodos, todo.id, true);
    setNotice(sectionKey, null);
    const result = await completeTodo(getClient(), todo.id);
    inFlight.current.delete(todo.id);
    toggle(setBusyTodos, todo.id, false);

    if (result === "done" || result === "already") {
      toggle(setDoneTodos, todo.id, true);
      setFocusRequest({ index: row.index, target: "open" });
      if (result === "done") {
        showToast({
          text: "Fatto:",
          emphasis: todo.title,
          onUndo: () => void undo(row, sectionKey),
        });
      } else {
        showToast({
          lead: todo.title,
          text: "era già fatto.",
          icon: null,
        });
      }
      return;
    }
    if (result === "gone") {
      toggle(setGoneTodos, todo.id, true);
      setNotice(sectionKey, { text: TODO_GONE, icon: "circle-alert" });
      setFocusRequest({ sectionKey, target: "notice" });
      return;
    }
    // The button is still there with the focus on it.
    setNotice(sectionKey, {
      text: doneFailureText(todo.title, result),
      icon: failureIcon(result),
    });
  };

  const markAllButton = (
    <Button
      variant="secondary"
      small
      icon="check"
      loading={marking}
      disabled={status !== "ready" || (!allMarked && newIds.size === 0)}
      inactive={allMarked || !online}
      onClick={() => void markAll()}
    >
      {MARK_ALL_LABEL}
    </Button>
  );

  if (status === "loading") return <NotificationsLoading />;

  const mainClass = "pagina pagina-desktop pagina-desktop--centrata";

  if (status === "error" || !loaded) {
    return (
      <main id="contenuto" tabIndex={-1} className={mainClass}>
        <PageHeader>{markAllButton}</PageHeader>
        <PageError
          headingLevel={2}
          retrying={retrying}
          onRetry={retry}
          exit={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      </main>
    );
  }

  const digestBlock =
    loaded.digest.kind === "ready" ? (
      <Digest view={loaded.digest.view} />
    ) : loaded.digest.kind === "error" ? (
      <Alert
        variant="errore"
        action={
          <Button variant="link" loading={digestRetrying} onClick={retryDigest}>
            Riprova
          </Button>
        }
      >
        {DIGEST_ERROR}
      </Alert>
    ) : null;

  return (
    <main id="contenuto" tabIndex={-1} className={mainClass} ref={mainRef}>
      <PageHeader>{markAllButton}</PageHeader>
      {!online ? (
        <div
          className="avviso avviso--errore"
          role="status"
          data-testid="avviso-offline"
        >
          <Icon name="wifi-off" />
          <span className="avviso__testo">
            {offlineText(formatTime(loaded.now))}
          </span>
          <Button variant="link" loading={retrying} onClick={retry}>
            Riprova
          </Button>
        </div>
      ) : null}
      {markFailure ? (
        <Alert variant="errore" icon={failureIcon(markFailure)}>
          {MARK_ALL_FAILURE[markFailure]}
        </Alert>
      ) : null}
      {digestBlock}
      {sections.map((section, sectionIndex) => {
        const headingId = `notifiche-sezione-${sectionIndex}`;
        const notice = notices[section.key];
        return (
          <section
            key={section.key}
            className="sezione"
            aria-labelledby={headingId}
            data-sezione={section.key}
          >
            <div className="sezione__testa">
              <h2 className="sezione__titolo" id={headingId}>
                {section.title}
              </h2>
              {section.newCount > 0 ? (
                <span className="sezione__info">
                  {newLabel(section.newCount)}
                </span>
              ) : null}
            </div>
            <ul className="scheda lista">
              {section.rows.map((row) => (
                <NotificationRow
                  key={row.index}
                  row={row}
                  isDone={
                    row.todo !== null &&
                    (row.todo.isDone || doneTodos.has(row.todo.id))
                  }
                  isGone={row.todo !== null && goneTodos.has(row.todo.id)}
                  isBusy={row.todo !== null && busyTodos.has(row.todo.id)}
                  inactive={!online}
                  onDone={() => void markDone(row, section.key)}
                />
              ))}
            </ul>
            {notice ? (
              <Alert variant="errore" icon={notice.icon}>
                {notice.text}
              </Alert>
            ) : null}
          </section>
        );
      })}
      {sections.length === 0 ? (
        <EmptyState
          icon="bell"
          title={EMPTY_TITLE}
          text={EMPTY_TEXT}
          actions={null}
        />
      ) : null}
      <div role="status" className="visivamente-nascosto">
        {announcement}
      </div>
    </main>
  );
}
