"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { PageError } from "@/components/ui/PageError/PageError";
import { QuickAddField } from "@/components/ui/QuickAddField/QuickAddField";
import { SectionSwitcher } from "@/components/ui/SegmentedControl/SectionSwitcher";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import {
  byCreation,
  byLastTaken,
  COMMON_THINGS,
  FEW_THINGS_LIMIT,
  nameKey,
  thingsLabel,
  type ShoppingItem,
  type ShoppingMember,
} from "./model";
import { SPESA_PAGE_CSS } from "./page-css";

const styles = {
  switcher: "spesa-selettore",
  onlyMobile: "spesa-solo-mobile",
  onlyDesktop: "spesa-solo-desktop",
  columnHead: "spesa-testa-colonna",
};
import { Tear } from "./Tear";
import { useShoppingList } from "./useShoppingList";

const TO_TAKE_HEADING = '[data-focus="to-take-heading"]';
const COMMON_HEADING = '[data-focus="common-heading"]';

function switcherItems(toTakeCount: number | undefined) {
  return [
    { key: "spesa", label: "Spesa", href: "/casa/spesa", count: toTakeCount },
    { key: "da-fare", label: "Da fare", href: "/casa/da-fare" },
    { key: "scadenze", label: "Scadenze", href: "/casa/scadenze" },
  ];
}

function PageTop({ nestName }: { nestName: string }) {
  return (
    <div className="intestazione-desktop">
      <div className="intestazione">
        <p className="intestazione__sopra">{nestName}</p>
        <h1 className="intestazione__titolo t-titolo-pagina">Casa</h1>
      </div>
    </div>
  );
}

function LoadingState({ nestName }: { nestName: string }) {
  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <style>{SPESA_PAGE_CSS}</style>
      <PageTop nestName={nestName} />
      <SectionSwitcher
        aria-label="Sezione della casa"
        items={switcherItems(undefined)}
        current="spesa"
        className={styles.switcher}
      />
      <div aria-busy="true" aria-live="polite">
        <VisuallyHidden>Caricamento in corso</VisuallyHidden>
        <div className={styles.onlyMobile}>
          <div className="gruppo-skeleton" aria-hidden="true">
            <Skeleton shape="riga" />
          </div>
          <div className="gruppo-skeleton" aria-hidden="true">
            <Skeleton shape="testo-corto" />
            <Skeleton shape="grande" />
          </div>
        </div>
        <div className={cx("colonne", "colonne--tre", styles.onlyDesktop)}>
          {[0, 1, 2].map((column) => (
            <div key={column} className="gruppo-skeleton" aria-hidden="true">
              <Skeleton shape="riga" />
              <Skeleton shape="grande" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Row({
  item,
  member,
  onToggle,
}: {
  item: ShoppingItem;
  member: ShoppingMember | undefined;
  onToggle: (key: string) => void;
}) {
  const taken = item.checkedAt !== null;
  return (
    <li
      className={cx("riga-lista", taken && "riga-lista--preso")}
      data-item-key={item.key}
      data-testid="spesa-riga"
    >
      <Checkbox
        variant="round"
        checked={taken}
        onChange={() => onToggle(item.key)}
        aria-label={
          taken ? `Rimetti in lista: ${item.name}` : `Preso: ${item.name}`
        }
      />
      <span className="riga-lista__testo">
        <span className="riga-lista__titolo">{item.name}</span>
      </span>
      <span className="riga-lista__valore">
        <span className="riga-lista__quantita">{item.quantity ?? ""}</span>
        {member ? (
          <Avatar name={member.name} color={member.color} nameShown />
        ) : null}
      </span>
    </li>
  );
}

function SectionHead({
  title,
  info,
  headingProps,
}: {
  title: string;
  info?: string;
  headingProps?: Record<string, string | number>;
}) {
  return (
    <div className="sezione__testa">
      <h3 className="sezione__titolo" tabIndex={-1} {...headingProps}>
        {title}
      </h3>
      {info ? <span className="sezione__info">{info}</span> : null}
    </div>
  );
}

function ComingSoonColumn({
  title,
  icon,
  text,
}: {
  title: string;
  icon: "square-check" | "file-clock";
  text: string;
}) {
  return (
    <section className={cx("colonna", styles.onlyDesktop)} aria-label={title}>
      <div className="sezione__testa">
        <h2 className="sezione__titolo">{title}</h2>
      </div>
      <EmptyState icon={icon} title="In arrivo" text={text} actions={null} />
    </section>
  );
}

export function SpesaPage({ nestName }: { nestName: string }) {
  const [quick, setQuick] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const list = useShoppingList({
    rootRef,
    onAddRejected: (name) => setQuick((current) => current || name),
  });
  const {
    status,
    items,
    members,
    meMemberId,
    settling,
    offline,
    requestFocus,
  } = list;

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
  useEffect(() => {
    // The alert is gone and "Riprova" with it: the focus goes to a heading.
    if (offline || !focusInAlert.current) return;
    focusInAlert.current = false;
    const root = rootRef.current;
    const target =
      root?.querySelector<HTMLElement>(COMMON_HEADING) ??
      root?.querySelector<HTMLElement>(TO_TAKE_HEADING);
    target?.focus();
  }, [offline]);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  // A row that was just toggled stays in its list while it settles.
  const toTake = useMemo(
    () =>
      items
        .filter((item) => (item.checkedAt === null) !== settling.has(item.key))
        .sort(byCreation),
    [items, settling],
  );
  const taken = useMemo(
    () =>
      items
        .filter((item) => (item.checkedAt !== null) !== settling.has(item.key))
        .sort(byLastTaken),
    [items, settling],
  );

  if (status === "loading") return <LoadingState nestName={nestName} />;

  if (status === "error") {
    return (
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        <PageError onRetry={() => window.location.reload()} />
      </main>
    );
  }

  const isEmpty = toTake.length === 0 && taken.length === 0;
  const pets = members.filter((member) => member.kind === "pet");
  const otherAdult = members.find(
    (member) => member.kind === "adult" && member.id !== meMemberId,
  );
  const inList = new Set(toTake.map((item) => nameKey(item.name)));
  const chips = [
    ...COMMON_THINGS,
    ...pets.map((pet) => `Crocchette per ${pet.name}`),
  ].filter((name) => !inList.has(nameKey(name)));
  const showCommon =
    (isEmpty || toTake.length < FEW_THINGS_LIMIT) && chips.length > 0;
  const clearableCount = taken.filter((item) => item.checkedAt !== null).length;

  const addChip = (name: string) => {
    const index = chips.indexOf(name);
    const neighbour = chips[index + 1] ?? chips[index - 1];
    requestFocus([
      ...(neighbour ? [`[data-chip="${CSS.escape(neighbour)}"]`] : []),
      TO_TAKE_HEADING,
    ]);
    list.addItem(name);
  };

  const renderRows = (rows: ShoppingItem[]) => (
    <ul className="scheda lista">
      {rows.map((item) => (
        <Row
          key={item.key}
          item={item}
          member={item.authorId ? membersById.get(item.authorId) : undefined}
          onToggle={list.toggleItem}
        />
      ))}
    </ul>
  );

  const quickLabel = isEmpty ? "Cosa manca in casa?" : "Aggiungi alla spesa…";

  let toTakeSection: ReactNode = null;
  if (toTake.length > 0) {
    toTakeSection = (
      <section className="sezione" data-testid="spesa-da-prendere">
        <SectionHead
          title="Da prendere"
          info={thingsLabel(toTake.length)}
          headingProps={{ "data-focus": "to-take-heading" }}
        />
        {renderRows(toTake)}
      </section>
    );
  } else if (taken.length > 0) {
    toTakeSection = (
      <section className="sezione" data-testid="spesa-da-prendere">
        <SectionHead
          title="Da prendere"
          headingProps={{ "data-focus": "to-take-heading" }}
        />
        <EmptyState
          icon="check"
          title="Tutto preso"
          text="Quando hai finito, togli i presi con le forbici qui sotto."
          actions={null}
        />
      </section>
    );
  }

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      ref={rootRef}
      className="pagina pagina-desktop"
    >
      <style>{SPESA_PAGE_CSS}</style>
      <PageTop nestName={nestName} />
      <SectionSwitcher
        aria-label="Sezione della casa"
        items={switcherItems(toTake.length)}
        current="spesa"
        className={styles.switcher}
      />
      <div className="colonne colonne--tre">
        <section className="colonna" aria-label="Spesa">
          <div className={cx("sezione__testa", styles.columnHead)}>
            <h2 className="sezione__titolo">Spesa</h2>
            {toTake.length > 0 ? (
              <span className="sezione__info">{toTake.length} da prendere</span>
            ) : null}
          </div>

          {offline ? (
            <Alert
              variant="errore"
              icon="wifi-off"
              action={
                <Button
                  variant="link"
                  loading={list.retrying}
                  onClick={list.retry}
                >
                  Riprova
                </Button>
              }
            >
              Sei offline: le cose che spunti partiranno appena torna la
              connessione.
            </Alert>
          ) : null}

          <QuickAddField
            label={quickLabel}
            value={quick}
            onChange={setQuick}
            onSubmit={list.addItem}
            active={isEmpty}
          />

          {showCommon ? (
            <section className="sezione" data-testid="spesa-piu-comuni">
              <SectionHead
                title="Le più comuni"
                info="un tocco per aggiungere"
                headingProps={{ "data-focus": "common-heading" }}
              />
              <div
                className="gruppo-chip"
                role="group"
                aria-label="Le più comuni"
              >
                {chips.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="chip"
                    aria-label={`Aggiungi ${name}`}
                    data-chip={name}
                    onClick={() => addChip(name)}
                  >
                    <Icon name="plus" size="s" />
                    {name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {isEmpty ? (
            <EmptyState
              icon="users"
              title="Una lista per tutta la casa"
              text={
                otherAdult
                  ? `Quando ${otherAdult.name} aggiunge qualcosa, lo vedi subito anche tu.`
                  : "Quando qualcuno entra nel Nest, vedrete la stessa lista."
              }
              actions={null}
            />
          ) : (
            <>
              {toTakeSection}
              {taken.length > 0 ? (
                <section className="sezione" data-testid="spesa-presi">
                  <SectionHead title="Presi" info={String(taken.length)} />
                  {renderRows(taken)}
                  <Tear count={clearableCount} onTear={list.tear} />
                </section>
              ) : null}
            </>
          )}
        </section>

        <ComingSoonColumn
          title="Da fare"
          icon="square-check"
          text="Qui ci saranno le cose da fare della casa. Stiamo preparando questa parte."
        />
        <ComingSoonColumn
          title="Scadenze"
          icon="file-clock"
          text="Qui ci saranno le scadenze della casa. Stiamo preparando questa parte."
        />
      </div>
      <div
        className="visivamente-nascosto"
        aria-live="polite"
        data-testid="spesa-annuncio"
      >
        {list.announcement}
      </div>
    </main>
  );
}
