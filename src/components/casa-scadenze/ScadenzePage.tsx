"use client";

import { useEffect, useMemo, useRef } from "react";
import { CasaFrame } from "@/components/casa/CasaFrame";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { useIsDesktop } from "@/components/ui/overlay";
import { PageError } from "@/components/ui/PageError/PageError";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { toDayKey } from "@/lib/datetime";
import { toView, urgentLabel, type DeadlineView } from "./model";
import { useDeadlines } from "./useDeadlines";

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

export function ScadenzePage({ nestName }: { nestName: string }) {
  const list = useDeadlines();
  const { status, retrying } = list;
  const isDesktop = useIsDesktop();
  const rootRef = useRef<HTMLElement>(null);

  // "Riprova" in the column error: when it works the button is gone, so the
  // focus goes to the column heading.
  const focusInRetry = useRef(false);
  useEffect(() => {
    const track = (event: FocusEvent) => {
      focusInRetry.current =
        event.target instanceof Element &&
        !!event.target.closest('[data-testid="scadenze-errore"]');
    };
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, []);
  useEffect(() => {
    if (status !== "ready" || !focusInRetry.current) return;
    focusInRetry.current = false;
    const heading = rootRef.current?.querySelector<HTMLElement>(
      'section[aria-label="Scadenze"] h2',
    );
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }, [status]);

  const { deadlines, members, meId } = list;
  const views = useMemo(() => {
    if (status !== "ready") return [];
    const now = new Date();
    const todayKey = toDayKey(now);
    const membersById = new Map(members.map((member) => [member.id, member]));
    return deadlines.map((deadline) =>
      toView(deadline, membersById, meId, now, todayKey),
    );
  }, [status, deadlines, members, meId]);

  if (status === "loading") {
    return <CasaFrame nestName={nestName} current="scadenze" loading />;
  }

  // Phone: the error takes the place of the page. Desktop: only the column.
  if (status === "error" && !isDesktop) {
    return (
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        <PageError
          onRetry={list.retry}
          retrying={retrying}
          exit={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      </main>
    );
  }

  const urgentCount = views.filter((view) => view.urgent).length;
  let content;
  if (status === "error") {
    content = (
      <div data-testid="scadenze-errore">
        <Alert
          variant="errore"
          action={
            <Button variant="link" loading={retrying} onClick={list.retry}>
              Riprova
            </Button>
          }
        >
          Non riusciamo a caricare le scadenze. Controlla la connessione e
          riprova.
        </Alert>
      </div>
    );
  } else if (views.length === 0) {
    content = (
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
  } else {
    content = (
      <section className="sezione" data-testid="scadenze-prossime">
        <div className="sezione__testa">
          <h3 className="sezione__titolo">Prossime</h3>
          <span className="sezione__info">in ordine di data</span>
        </div>
        <ul className="scheda lista">
          {views.map((view) => (
            <Row key={view.deadline.id} view={view} />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <CasaFrame
      nestName={nestName}
      current="scadenze"
      counts={{
        spesa: list.counts.spesa,
        "da-fare": list.counts.todo,
        scadenze: status === "ready" ? views.length : undefined,
      }}
      mainRef={rootRef}
      columns={{
        scadenze: {
          info: status === "ready" ? urgentLabel(urgentCount) : undefined,
          children: content,
        },
      }}
    />
  );
}
