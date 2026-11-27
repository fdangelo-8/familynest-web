import { it } from "@/lib/i18n/messages/it";
import { Avatar, type AvatarColor } from "../Avatar/Avatar";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";

export type FaceGridPerson = {
  id: string;
  name: string;
  color: AvatarColor;
  /** The line under the name («Invito da mandare», «9 anni») */
  line?: string;
  /** Photo of an animal: the thread of its colour goes around it */
  photoSrc?: string;
  /** Two letters when someone shares the first one (`memberInitials`) */
  initials?: string;
};

export type FaceGridProps = {
  /** Accessible name of the list («Persone del Nest») */
  label: string;
  people: readonly FaceGridPerson[];
  /** Touch on a face: the page opens that person */
  onSelect: (id: string) => void;
  /** Adds the dashed «Aggiungi» circle at the end. Without it there is none. */
  onAdd?: () => void;
  /** Text and name of the add circle; «Aggiungi» without it */
  addLabel?: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * People as faces in a grid (`.volti`): circles of 72 px in three columns,
 * name and a line under each; the face is touched to open it. At the end the
 * dashed «Aggiungi» circle of the same size. With nobody, only «Aggiungi».
 * Animal with a photo: the thread of its colour; without: the initial.
 */
export function FaceGrid({
  label,
  people,
  onSelect,
  onAdd,
  addLabel = it.choicesPeople.add,
  className,
  "data-testid": testId,
}: FaceGridProps) {
  return (
    <ul
      className={cx("volti", className)}
      aria-label={label}
      data-testid={testId}
    >
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            className="volti__voce"
            onClick={() => onSelect(person.id)}
          >
            <Avatar
              name={person.name}
              color={person.color}
              initials={person.initials}
              size="xl"
              photoSrc={person.photoSrc}
              ring
              nameShown
            />
            <span className="volti__nome">{person.name}</span>
            {person.line ? (
              <span className="volti__riga">{person.line}</span>
            ) : null}
          </button>
        </li>
      ))}
      {onAdd ? (
        <li>
          <button type="button" className="volti__voce" onClick={onAdd}>
            <span className="volti__aggiungi" aria-hidden="true">
              <Icon name="plus" size="l" />
            </span>
            <span className="volti__nome">{addLabel}</span>
          </button>
        </li>
      ) : null}
    </ul>
  );
}
