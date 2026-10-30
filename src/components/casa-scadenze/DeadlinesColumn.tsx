"use client";

import { useMemo } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { toView, type DeadlineView } from "./model";
import type { DeadlinesList } from "./useDeadlines";

function Row({ view }: { view: DeadlineView }) {
  const { deadline, howMuch, urgent, avatar, hiddenNote } = view;
  const avatarNode = avatar ? (
    <Avatar name={avatar.name} color={avatar.color} nameShown />
  ) : null;
  return (
    <li data-testid="scadenza-riga">
      {/* Not interactive until the Aggiungi page (#22) opens it for editing. */}
      <div className="riga-scadenza">
        <span className="riga-scadenza__giorni">
          <span
            className={cx(
              "riga-scadenza__numero",
              howMuch.word && "riga-scadenza__numero--parola",
            )}
          >
            {howMuch.number}
            {urgent ? (
              <span
                className="pallino-urgente"
                aria-hidden="true"
                data-testid="pallino-urgente"
              />
            ) : null}
          </span>
          {howMuch.unit ? (
            <span className="riga-scadenza__unita">{howMuch.unit}</span>
          ) : null}
          {urgent ? <VisuallyHidden>, urgente</VisuallyHidden> : null}
        </span>
        <span className="riga-lista__testo">
          <span className="riga-lista__titolo">{deadline.title}</span>
          <span
            className={cx(
              "riga-lista__info",
              urgent && "riga-lista__info--allerta",
            )}
          >
            {view.info}
          </span>
          {hiddenNote ? <VisuallyHidden>{hiddenNote}</VisuallyHidden> : null}
        </span>
        {deadline.isPrivate ? (
          <span className="riga-lista__valore">
            <span className="riga-lista__lucchetto" data-testid="lucchetto">
              <Icon name="lock" size="s" />
            </span>
            {avatarNode}
          </span>
        ) : (
          avatarNode
        )}
      </div>
    </li>
  );
}

/** Marks the group headings the focus can land on (#22 will use it). */
export const DEADLINE_HEADING = '[data-focus="scadenze-heading"]';

function Group({
  testId,
  title,
  info,
  views,
}: {
  testId: string;
  title: string;
  info: string;
  views: ReadonlyArray<DeadlineView>;
}) {
  return (
    <section className="sezione" data-testid={testId}>
      <div className="sezione__testa">
        <h3
          className="sezione__titolo"
          tabIndex={-1}
          data-focus="scadenze-heading"
        >
          {title}
        </h3>
        <span className="sezione__info">{info}</span>
      </div>
      <ul className="scheda lista">
        {views.map((view) => (
          <Row key={view.deadline.id} view={view} />
        ))}
      </ul>
    </section>
  );
}

/** What every row shows, from the data and the member who is looking. */
export function useDeadlineViews(list: DeadlinesList): DeadlineView[] {
  const { status, deadlines, members, meId } = list;
  return useMemo(() => {
    if (status !== "ready") return [];
    const now = new Date();
    const membersById = new Map(members.map((member) => [member.id, member]));
    return deadlines.map((deadline) =>
      toView(deadline, membersById, meId, now),
    );
  }, [status, deadlines, members, meId]);
}

/**
 * The «Scadenze» column of Casa. The page error and the focus after
 * «Riprova» belong to the page and to the frame.
 */
export function DeadlinesColumn({
  list,
  views,
}: {
  list: DeadlinesList;
  views: ReadonlyArray<DeadlineView>;
}) {
  if (list.status === "error") {
    return (
      <div data-testid="scadenze-errore">
        <Alert
          variant="errore"
          action={
            <Button variant="link" loading={list.retrying} onClick={list.retry}>
              Riprova
            </Button>
          }
        >
          Non riusciamo a caricare le scadenze. Controlla la connessione e
          riprova.
        </Alert>
      </div>
    );
  }
  if (views.length === 0) {
    return (
      <EmptyState
        large
        title="Nessuna scadenza"
        text="Documenti, bollo, assicurazioni, abbonamenti: aggiungili e vedi sempre quanto manca."
        actions={
          <Button full href="/aggiungi">
            Aggiungi una scadenza
          </Button>
        }
      />
    );
  }
  const overdue = views.filter((view) => view.overdue);
  const upcoming = views.filter((view) => !view.overdue);
  return (
    <>
      {overdue.length > 0 ? (
        <Group
          testId="scadenze-scadute"
          title="Scadute"
          info={String(overdue.length)}
          views={overdue}
        />
      ) : null}
      {upcoming.length > 0 ? (
        <Group
          testId="scadenze-prossime"
          title="Prossime"
          info="in ordine di data"
          views={upcoming}
        />
      ) : null}
    </>
  );
}
