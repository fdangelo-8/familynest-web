"use client";

import Link from "next/link";
import { cx } from "../cx";
import { useNest } from "../AppFrame/NestProvider";

/** The Nest square: one dot per each of the first 4 members, links to /nest. */
export function NestSquare({ className }: { className?: string }) {
  const { nestName, members } = useNest();
  const label = nestName
    ? `Apri ${nestName}: membri, Esplora e impostazioni`
    : "Apri il tuo Nest: membri, Esplora e impostazioni";

  return (
    <Link
      href="/nest"
      className={cx("quadrato-nest", className)}
      aria-label={label}
    >
      {members.slice(0, 4).map((member, index) => (
        <span
          key={index}
          className={`quadrato-nest__punto membro-${member.color}`}
          data-color={member.color}
          aria-hidden="true"
        />
      ))}
    </Link>
  );
}
