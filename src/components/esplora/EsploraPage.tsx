"use client";

import Link from "next/link";
import { useRef, type Ref } from "react";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Icon } from "@/components/ui/Icon/Icon";
import { PageError } from "@/components/ui/PageError/PageError";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import {
  getAvailableSpaces,
  getSpacePromise,
  type SpaceDef,
  type SpaceKey,
} from "@/lib/spaces";
import { cx } from "@/components/ui/cx";
import { useSpaces, type NestPerson } from "./useSpaces";

const SKELETON_CARDS = 6;

function Header({ headingRef }: { headingRef: Ref<HTMLHeadingElement> }) {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">Esplora</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="intestazione__titolo t-titolo-pagina"
      >
        Cosa può fare
        <br /> la vostra casa
      </h1>
      <p className="intestazione__sotto">
        Scegli gli spazi che vi servono. Con la puntina li fissi in fondo a
        Oggi.
      </p>
    </div>
  );
}

function People({ people }: { people: NestPerson[] }) {
  return (
    <span className="avatar-gruppo">
      {people.map((person, index) => (
        <Avatar
          key={index}
          name={person.name}
          color={person.color}
          size="xs"
          nameShown
        />
      ))}
    </span>
  );
}

/** Esplora: the catalogue of the spaces, with the puntina to pin them in Oggi. */
export function EsploraPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRefs = useRef(new Map<SpaceKey, HTMLElement>());
  const { status, data, pinned, retrying, retry, toggle } =
    useSpaces(buttonRefs);

  const spaces: SpaceDef[] = data ? getAvailableSpaces(data.counts) : [];

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <div className="colonna">
          <Header headingRef={headingRef} />
        </div>
        <div className="colonna">
          {status === "loading" ? (
            <SkeletonGroup aria-live="polite">
              <div className="griglia-moduli">
                {Array.from({ length: SKELETON_CARDS }, (_, index) => (
                  <Skeleton key={index} shape="scheda" />
                ))}
              </div>
            </SkeletonGroup>
          ) : null}
          {status === "error" ? (
            <PageError
              headingLevel={2}
              retrying={retrying}
              onRetry={() => retry(() => headingRef.current?.focus())}
              exit={{ label: "Torna a Oggi", href: "/oggi" }}
            />
          ) : null}
          {status === "ready" && data ? (
            <ul className="griglia-moduli">
              {spaces.map((space) => {
                const isPinned = pinned.includes(space.key);
                const people =
                  space.key === "children"
                    ? data.children
                    : space.key === "pets"
                      ? data.pets
                      : null;
                return (
                  <li
                    key={space.key}
                    className={cx(
                      "scheda-modulo",
                      space.wide && "scheda-modulo--largo",
                      space.dark && "scheda-modulo--scura",
                    )}
                  >
                    <div className="scheda-modulo__alto">
                      <span className="scheda-modulo__icona">
                        <Icon name={space.icon} />
                      </span>
                      <button
                        type="button"
                        className="puntina"
                        aria-pressed={isPinned}
                        aria-label={
                          isPinned
                            ? `Togli ${space.name} da Oggi`
                            : `Fissa ${space.name} in Oggi`
                        }
                        ref={(node) => {
                          if (node) buttonRefs.current.set(space.key, node);
                          else buttonRefs.current.delete(space.key);
                        }}
                        onClick={() => void toggle(space.key)}
                      >
                        <Icon name="pin" size="s" />
                      </button>
                    </div>
                    <Link className="scheda-modulo__link" href={space.href}>
                      <span className="scheda-modulo__titolo">
                        {space.name}
                      </span>
                      <span className="scheda-modulo__promessa">
                        {getSpacePromise(space.key, {
                          childNames: data.children.map((p) => p.name),
                          petNames: data.pets.map((p) => p.name),
                        })}
                      </span>
                      {people ? <People people={people} /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </main>
  );
}
