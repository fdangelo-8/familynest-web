"use client";

import { useSyncExternalStore } from "react";
import { cx } from "../cx";
import { Avatar } from "../Avatar/Avatar";
import { useNest } from "../AppFrame/NestProvider";
import {
  getLensSnapshot,
  getServerLensSnapshot,
  setLens,
  subscribeLens,
  type Lens as LensValue,
} from "@/lib/lens";

/** Current lens, shared by the whole app. Always "io" until the browser tab chooses. */
export function useLens(): [LensValue, (lens: LensValue) => void] {
  const lens = useSyncExternalStore(
    subscribeLens,
    getLensSnapshot,
    getServerLensSnapshot,
  );
  return [lens, setLens];
}

/** "Io / Nest" point-of-view switch (`.selettore.lente`). */
export function Lens({ className }: { className?: string }) {
  const { members } = useNest();
  const [lens, changeLens] = useLens();
  const me = members.find((member) => member.isMe);
  const firstThree = members.slice(0, 3);

  return (
    <div
      className={cx("selettore", "lente", className)}
      role="group"
      aria-label="Punto di vista: solo tu o tutto il Nest"
    >
      <button
        type="button"
        className="selettore__voce"
        aria-pressed={lens === "io"}
        onClick={() => changeLens("io")}
      >
        {me ? (
          <span className="avatar-gruppo" role="img" aria-label={me.name}>
            <Avatar name={me.name} color={me.color} size="xs" nameShown />
          </span>
        ) : null}
        Io
      </button>
      <button
        type="button"
        className="selettore__voce"
        aria-pressed={lens === "nest"}
        onClick={() => changeLens("nest")}
      >
        {firstThree.length > 0 ? (
          <span
            className="avatar-gruppo"
            role="img"
            aria-label={firstThree.map((member) => member.name).join(", ")}
          >
            {firstThree.map((member, index) => (
              <Avatar
                key={index}
                name={member.name}
                color={member.color}
                size="xs"
                nameShown
              />
            ))}
          </span>
        ) : null}
        Nest
      </button>
    </div>
  );
}
