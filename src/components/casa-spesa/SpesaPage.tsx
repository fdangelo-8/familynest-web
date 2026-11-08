"use client";

import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { editHref, rememberOpener } from "@/components/aggiungi/coordination";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { QuickAddField } from "@/components/ui/QuickAddField/QuickAddField";
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

import { Tear } from "./Tear";
import type { ShoppingList } from "./useShoppingList";

export const TO_TAKE_HEADING = '[data-focus="to-take-heading"]';
export const COMMON_HEADING = '[data-focus="common-heading"]';

/** «, se ne occupa Laura» / «, se ne occupano Laura e Sofia» (read, not seen). */
function carersText(names: string[]): string {
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  return `, se ne occupa${names.length === 1 ? "" : "no"} ${list}`;
}

function Row({
  item,
  carers,
  author,
  onToggle,
  onEdit,
}: {
  item: ShoppingItem;
  /** The people who take care of it, if any */
  carers: ShoppingMember[];
  /** Who added it: shown when nobody takes care of it */
  author: ShoppingMember | undefined;
  onToggle: (key: string) => void;
  /** Opens the sheet to edit it (a thing not saved yet has no button) */
  onEdit: (item: ShoppingItem) => void;
}) {
  const taken = item.checkedAt !== null;
  const editable = !taken && !item.id.startsWith("tmp-");
  const shown = carers.length > 0 ? carers : author ? [author] : [];
  const avatars = shown.map((member) => (
    <Avatar key={member.id} name={member.name} color={member.color} nameShown />
  ));
  return (
    <li
      className={cx(
        "riga-lista",
        taken && "riga-lista--preso",
        editable && "riga-lista--modificabile",
      )}
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
        {editable ? (
          <button
            type="button"
            className="riga-lista__titolo"
            data-edit-id={item.id}
            aria-label={`Modifica: ${item.name}`}
            onClick={() => onEdit(item)}
          >
            {item.name}
          </button>
        ) : (
          <span className="riga-lista__titolo">{item.name}</span>
        )}
        {carers.length > 0 ? (
          <VisuallyHidden>
            {carersText(carers.map((c) => c.name))}
          </VisuallyHidden>
        ) : null}
      </span>
      <span className="riga-lista__valore">
        <span className="riga-lista__quantita">{item.quantity ?? ""}</span>
        {avatars.length > 1 ? (
          <span className="avatar-gruppo">{avatars}</span>
        ) : (
          avatars
        )}
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

/**
 * The rows of «Da prendere» and «Presi». A row that was just toggled stays in
 * its list while it settles.
 */
export function splitShopping(
  items: ShoppingItem[],
  settling: ReadonlySet<string>,
) {
  return {
    toTake: items
      .filter((item) => (item.checkedAt === null) !== settling.has(item.key))
      .sort(byCreation),
    taken: items
      .filter((item) => (item.checkedAt !== null) !== settling.has(item.key))
      .sort(byLastTaken),
  };
}

/** What goes inside the «Spesa» column (the frame draws the column itself). */
export function SpesaColumn({
  list,
  quick,
  onQuickChange,
}: {
  list: ShoppingList;
  quick: string;
  onQuickChange: (value: string) => void;
}) {
  const router = useRouter();
  const { items, members, meMemberId, settling, requestFocus } = list;

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const { toTake, taken } = useMemo(
    () => splitShopping(items, settling),
    [items, settling],
  );

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

  const openEditor = (item: ShoppingItem) => {
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    rememberOpener({
      kind: "shopping",
      id: item.id,
      primary: `[data-edit-id="${CSS.escape(item.id)}"]`,
      fallbacks: [
        TO_TAKE_HEADING,
        COMMON_HEADING,
        desktop ? '[data-casa-column="spesa"] h2' : "h1",
      ],
    });
    router.push(editHref("spesa", item.id));
  };

  const renderRows = (rows: ShoppingItem[]) => (
    <ul className="scheda lista">
      {rows.map((item) => (
        <Row
          key={item.key}
          item={item}
          carers={item.assigneeIds.flatMap((id) => membersById.get(id) ?? [])}
          author={item.authorId ? membersById.get(item.authorId) : undefined}
          onToggle={list.toggleItem}
          onEdit={openEditor}
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
    <>
      <QuickAddField
        label={quickLabel}
        value={quick}
        onChange={onQuickChange}
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
          <div className="gruppo-chip" role="group" aria-label="Le più comuni">
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
    </>
  );
}
