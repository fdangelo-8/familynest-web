"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { addMember, updateMember } from "@/app/onboarding/persone/actions";
import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import type {
  ChoosableColor,
  TakenColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import { Icon } from "@/components/ui/Icon/Icon";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import {
  MemberSheet,
  type MemberKind,
  type MemberSaveResult,
  type MemberValues,
} from "@/components/ui/MemberSheet/MemberSheet";
import {
  HOUSEHOLD_FULL_MESSAGE,
  MAX_HOUSEHOLD_MEMBERS,
} from "@/lib/household-limits";
import type { Database } from "@/types/database";
import styles from "./onboarding.module.css";
import { BackArrow, BackLink } from "./PeopleBack";
import { Steps } from "./Steps";

/** One member of the Nest as the page needs it. No account id, no email. */
export type Person = {
  id: string;
  name: string;
  color: ChoosableColor;
  kind: MemberKind;
  birthDate: string | null;
  /** The signed-in person: the title reads "<nome>, tu" */
  isYou: boolean;
  /** Has a FamilyNest account (always an adult) */
  hasAccount: boolean;
  /** Second line of the row, already worded */
  info: string;
};

type HouseholdType = Database["public"]["Enums"]["household_type"];

type SheetState = {
  /** The member being changed; `null` when adding */
  person: Person | null;
  /** Colours of the others, frozen when the sheet opens */
  taken: TakenColor[];
};

/**
 * Where "Continua" goes. Provisional (#13): Calendario (#37) and Invito
 * (#14) are not on main yet, so it ends in Pronto (#15). Each of those pages
 * moves this when it arrives.
 */
const NEXT_STEP = "/onboarding/pronto";

function Roster({
  prefix,
  people,
  full,
  onAdd,
  onEdit,
}: {
  prefix: string;
  people: Person[];
  full: boolean;
  onAdd: () => void;
  onEdit: (person: Person) => void;
}) {
  const fullId = `${prefix}-completo`;
  return (
    <>
      <ul className="scheda lista" aria-label="Persone del Nest">
        {people.map((person) => (
          <li key={person.id} className="riga-lista">
            <Avatar
              name={person.name}
              color={person.color}
              size="l"
              nameShown
            />
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">
                {person.isYou ? `${person.name}, tu` : person.name}
              </span>
              <span className="riga-lista__info">{person.info}</span>
            </span>
            <IconButton
              icon="pencil"
              small
              aria-label={`Modifica ${person.name}`}
              onClick={() => onEdit(person)}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn-tratteggiato"
        disabled={full}
        aria-describedby={full ? fullId : undefined}
        onClick={onAdd}
      >
        <Icon name="plus" />
        Aggiungi una persona o un animale
      </button>
      {full ? (
        <p className="campo__aiuto" id={fullId}>
          {HOUSEHOLD_FULL_MESSAGE}
        </p>
      ) : null}
    </>
  );
}

function Heading() {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">La tua famiglia</p>
      <h1 className="intestazione__titolo t-titolo-pagina">
        Chi c&apos;è nel Nest?
      </h1>
    </div>
  );
}

/**
 * Step 2 of the onboarding (mockup 03): the people and pets of the Nest.
 * Two layouts in one <main>, one visible at a time, sharing one state; one
 * sheet (add or change) outside both. "Continua" writes nothing.
 */
export function PeopleStep({
  householdType,
  people,
}: {
  householdType: HouseholdType;
  people: Person[];
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Only the answer of step 1 counts, not the people added here (#13).
  const total = householdType === "single" ? 3 : 4;
  const full = people.length >= MAX_HOUSEHOLD_MEMBERS;
  const defaultKind: MemberKind =
    householdType === "family_with_children" ? "child" : "adult";

  const takenBy = (others: Person[]): TakenColor[] =>
    others.map((person) => ({ color: person.color, by: person.name }));

  const refresh = () => startTransition(() => router.refresh());
  // The list is out of date after a refused save (Nest already full).
  const stale = useRef(false);
  // The tenth member leaves no "Aggiungi" to go back to: focus goes to Continua.
  const focusContinue = useRef(false);
  const mobileActions = useRef<HTMLDivElement>(null);
  const desktopActions = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sheet !== null || !focusContinue.current) return;
    focusContinue.current = false;
    for (const box of [mobileActions.current, desktopActions.current]) {
      const button = box?.querySelector("button");
      if (button && button.offsetParent !== null) {
        button.focus();
        return;
      }
    }
  }, [sheet]);

  function openAdd() {
    setAnnouncement("");
    setSheet({ person: null, taken: takenBy(people) });
  }

  function openEdit(person: Person) {
    setAnnouncement("");
    setSheet({
      person,
      taken: takenBy(people.filter((other) => other.id !== person.id)),
    });
  }

  function save(values: MemberValues): Promise<MemberSaveResult> {
    const input = {
      name: values.name,
      kind: values.kind,
      birthDate: values.birthDate,
      color: values.color,
    };
    return (
      sheet?.person ? updateMember(sheet.person.id, input) : addMember(input)
    ).then((result) => {
      if (!result.ok && result.reason === "full") stale.current = true;
      return result;
    });
  }

  function onSaved(values: MemberValues) {
    setAnnouncement(
      sheet?.person ? "Modifiche salvate." : `${values.name} è nel Nest.`,
    );
    if (!sheet?.person && people.length + 1 >= MAX_HOUSEHOLD_MEMBERS) {
      focusContinue.current = true;
    }
    refresh();
  }

  function onClose() {
    setSheet(null);
    if (stale.current) {
      stale.current = false;
      refresh();
    }
  }

  const goOn = () => router.push(NEXT_STEP);

  return (
    <main className={styles.root}>
      <div role="status">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </div>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <BackArrow />
          <Steps current={2} total={total} />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        <Heading />
        <div className="sezione">
          <Roster
            prefix="m"
            people={people}
            full={full}
            onAdd={openAdd}
            onEdit={openEdit}
          />
        </div>
        <div className="dialogo__azioni" ref={mobileActions}>
          <Button full onClick={goOn}>
            Continua
          </Button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <Steps current={2} total={total} />
          <div className="sezione">
            <Heading />
            <Roster
              prefix="d"
              people={people}
              full={full}
              onAdd={openAdd}
              onEdit={openEdit}
            />
          </div>
          <div className="modale__piede" ref={desktopActions}>
            <BackLink />
            <Button onClick={goOn}>Continua</Button>
          </div>
        </div>
      </div>

      <MemberSheet
        open={sheet !== null}
        mode={sheet?.person ? "edit" : "add"}
        member={
          sheet?.person
            ? {
                name: sheet.person.name,
                kind: sheet.person.kind,
                color: sheet.person.color,
                birthDate: sheet.person.birthDate,
                hasAccount: sheet.person.hasAccount,
              }
            : undefined
        }
        defaultKind={defaultKind}
        taken={sheet?.taken ?? []}
        onSave={save}
        onSaved={onSaved}
        onClose={onClose}
      />
    </main>
  );
}
