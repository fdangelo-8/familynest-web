"use client";

import { useRef, type PointerEvent } from "react";
import { Icon } from "@/components/ui/Icon/Icon";

/** Release beyond this part of the run tears (spec: 80%). */
const TEAR_THRESHOLD = 0.8;

function readPx(name: string): number {
  const value = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return Number.isNaN(value) ? 0 : value;
}

type Drag = {
  pointerId: number;
  startX: number;
  maxMove: number;
  travel: number;
  position: number;
};

/**
 * The "strappo": the scissors slide along the line. A release past 80% of the
 * run tears, a tap (move under 8 px) tears too, Enter and Space tear from the
 * keyboard. The position is handed to the CSS in `--strappo-avanzamento`.
 */
export function Tear({
  count,
  onTear,
}: {
  count: number;
  onTear: (fromKeyboard: boolean) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  // A pointer gesture is followed by a click: it was already handled.
  const pointerHandled = useRef(false);

  const setProgress = (value: number) => {
    stripRef.current?.style.setProperty("--strappo-avanzamento", `${value}px`);
  };

  const finish = (blade: HTMLElement, complete: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    stripRef.current?.classList.remove("is-trascinato");
    if (!drag) return;
    if (blade.hasPointerCapture(drag.pointerId)) {
      blade.releasePointerCapture(drag.pointerId);
    }
    if (!complete) {
      setProgress(0);
      return;
    }
    const tapLimit = readPx("--space-2");
    const isTap = drag.maxMove < tapLimit;
    setProgress(0);
    if (isTap || drag.position / drag.travel > TEAR_THRESHOLD) onTear(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !stripRef.current) return;
    pointerHandled.current = true;
    const blade = event.currentTarget;
    const edge = parseFloat(getComputedStyle(blade).left) || 0;
    const travel = Math.max(
      1,
      stripRef.current.clientWidth - blade.offsetWidth - 2 * edge,
    );
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      maxMove: 0,
      travel,
      position: 0,
    };
    blade.setPointerCapture(event.pointerId);
    stripRef.current.classList.add("is-trascinato");
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    drag.maxMove = Math.max(drag.maxMove, Math.abs(delta));
    drag.position = Math.min(Math.max(delta, 0), drag.travel);
    setProgress(drag.position);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    finish(event.currentTarget, true);
    window.setTimeout(() => {
      pointerHandled.current = false;
    }, 100);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    finish(event.currentTarget, false);
    pointerHandled.current = false;
  };

  // A click without a pointer gesture comes from the keyboard or assistive tools.
  const handleClick = () => {
    if (pointerHandled.current) return;
    onTear(true);
  };

  return (
    <div className="strappo" ref={stripRef} data-testid="spesa-strappo">
      <span className="strappo__linea" aria-hidden="true" />
      <span className="strappo__testo" aria-hidden="true">
        <span>Trascina per strappare i presi</span>
      </span>
      <button
        type="button"
        className="strappo__lama"
        aria-label={
          count === 1
            ? "Togli dalla lista la cosa presa"
            : `Togli dalla lista le ${count} cose prese`
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
      >
        <Icon name="scissors" />
      </button>
    </div>
  );
}
