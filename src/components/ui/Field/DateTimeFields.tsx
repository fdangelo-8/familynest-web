"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  formatFieldDay,
  isValidDayKey,
  parseTimeInput,
  todayKeyInRome,
} from "@/lib/datetime";
import { it } from "@/lib/i18n/messages/it";
import { MonthCalendar } from "../MonthCalendar/MonthCalendar";
import { useEscapeLayer, useIsWindow } from "../overlay";
import { Sheet } from "../Sheet/Sheet";
import type { TextFieldProps } from "./Field";
import { FieldShell, useFieldIds } from "./FieldShell";

export type DateFieldProps = Omit<TextFieldProps, "type" | "multiline">;

/** Space kept between the calendar box and the edge of the window, in px. */
const EDGE = 8;

/**
 * The event of a value chosen by the component: `target.value` and
 * `currentTarget.value` are the new value, as with a native input.
 */
function valueEvent(
  value: string,
  name: string | undefined,
): ChangeEvent<HTMLInputElement> {
  const target = { value, name: name ?? "" };
  return {
    target,
    currentTarget: target,
    type: "change",
  } as unknown as ChangeEvent<HTMLInputElement>;
}

/**
 * Date field on our own (never `<input type="date">`): a button that shows the
 * day («Mercoledì 18 novembre», the year only if it is not this one) and opens
 * the month calendar: a sheet on the phone, a box under the field in a window.
 * The value is `YYYY-MM-DD`, a calendar day in Rome. One tap on a day chooses
 * it and closes.
 */
export function DateField({
  label,
  help,
  error,
  className,
  id,
  grouped,
  groupErrorId,
  value,
  defaultValue,
  onChange,
  min,
  max,
  name,
  disabled,
  readOnly,
}: DateFieldProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(
    defaultValue === undefined ? "" : String(defaultValue),
  );
  const current = controlled ? String(value) : inner;
  const shownDay = isValidDayKey(current) ? current : "";
  const { inputId, helpId, errorId, described } = useFieldIds(
    id,
    help,
    error,
    groupErrorId,
  );
  const windowShape = useIsWindow();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inactive = Boolean(disabled || readOnly);

  const text = shownDay ? formatFieldDay(shownDay, todayKeyInRome()) : "";
  const accessibleName = text ? `${label}, ${text}` : label;

  const closeBox = (returnFocus: boolean) => {
    setOpen(false);
    setClosing(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEscapeLayer(open && windowShape, () => closeBox(true));

  // Box under the field (above when there is no room below): its place is
  // given to CSS as two variables, so the box can leave a scrolling modal.
  useLayoutEffect(() => {
    if (!open || !windowShape) return;
    const place = () => {
      const trigger = triggerRef.current;
      const box = boxRef.current;
      if (!trigger || !box) return;
      const rect = trigger.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom;
      const above = roomBelow < box.offsetHeight && rect.top > roomBelow;
      const left = Math.max(
        EDGE,
        Math.min(rect.left, window.innerWidth - box.offsetWidth - EDGE),
      );
      box.style.setProperty("--riquadro-x", `${left}px`);
      box.style.setProperty(
        "--riquadro-top",
        above ? "auto" : `${rect.bottom}px`,
      );
      box.style.setProperty(
        "--riquadro-bottom",
        above ? `${window.innerHeight - rect.top}px` : "auto",
      );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, windowShape]);

  // The focus goes to the day; a tap outside closes; so does any scroll.
  useEffect(() => {
    if (!open || !windowShape) return;
    boxRef.current
      ?.querySelector<HTMLElement>("[data-autofocus]")
      ?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeBox(true);
    };
    const onScroll = (event: Event) => {
      if (boxRef.current?.contains(event.target as Node)) return;
      closeBox(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, windowShape]);

  const openCalendar = () => {
    if (inactive) return;
    setOpen(true);
  };

  const choose = (dayKey: string) => {
    if (dayKey !== current) {
      if (!controlled) setInner(dayKey);
      onChange?.(valueEvent(dayKey, name));
    }
    if (windowShape) closeBox(true);
    else setClosing(true);
  };

  // Tab leaves the box: the focus goes back to the field and the keystroke
  // carries it to the next one.
  const onBoxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") closeBox(true);
  };

  const onBoxBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next) return;
    if (boxRef.current?.contains(next)) return;
    if (triggerRef.current?.contains(next)) return;
    closeBox(false);
  };

  return (
    <FieldShell
      {...{
        label,
        help,
        error,
        className,
        inputId,
        helpId,
        errorId,
        grouped,
        groupErrorId,
      }}
      always
    >
      {name ? <input type="hidden" name={name} value={shownDay} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={inputId}
        className="campo__input campo__input--data"
        aria-haspopup="dialog"
        aria-label={accessibleName}
        disabled={disabled}
        aria-disabled={readOnly || undefined}
        onClick={openCalendar}
        {...described}
      >
        <span className="campo__valore">{text}</span>
      </button>
      {open && windowShape
        ? createPortal(
            <div
              ref={boxRef}
              className="calendario-riquadro"
              role="dialog"
              aria-label={label}
              onBlur={onBoxBlur}
              onKeyDown={onBoxKeyDown}
              data-testid="calendario-riquadro"
            >
              <MonthCalendar
                label={label}
                value={shownDay}
                min={min === undefined ? undefined : String(min)}
                max={max === undefined ? undefined : String(max)}
                onSelect={choose}
                markInitialFocus
              />
            </div>,
            document.body,
          )
        : null}
      <Sheet
        open={open && !windowShape}
        title={label}
        closeRequested={closing}
        onClose={() => closeBox(true)}
        data-testid="calendario-foglio"
      >
        <MonthCalendar
          label={label}
          value={shownDay}
          min={min === undefined ? undefined : String(min)}
          max={max === undefined ? undefined : String(max)}
          onSelect={choose}
          markInitialFocus
        />
      </Sheet>
    </FieldShell>
  );
}

/**
 * Time field on our own (never `<input type="time">`): a text field with the
 * numeric keypad, always 24 hours. «1730», «17», «17.30» and «17:30» are all
 * read; leaving the field (or Enter) writes `HH:MM` and gives the value to
 * `onChange`. A time that cannot exist shows the error under the field and the
 * value of before stays.
 */
export function TimeField({
  label,
  help,
  error,
  className,
  id,
  grouped,
  groupErrorId,
  value,
  defaultValue,
  onChange,
  onBlur,
  onKeyDown,
  name,
  required,
  disabled,
  readOnly,
}: DateFieldProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(
    defaultValue === undefined ? "" : String(defaultValue),
  );
  const current = controlled ? String(value) : inner;
  const [text, setText] = useState(current);
  const [seen, setSeen] = useState(current);
  const [unreadable, setUnreadable] = useState(false);
  // The page changed the value (for example from a phrase): show it.
  if (seen !== current) {
    setSeen(current);
    setText(current);
    setUnreadable(false);
  }
  const shownError = unreadable ? it.sheetsDates.timeInvalid : error;
  const { inputId, helpId, errorId, described } = useFieldIds(
    id,
    help,
    shownError,
    unreadable ? undefined : groupErrorId,
  );

  const commit = () => {
    const typed = text.trim();
    if (typed === "") {
      setUnreadable(false);
      setText("");
      if (current !== "") emit("");
      return;
    }
    const parsed = parseTimeInput(typed);
    if (parsed === null) {
      setUnreadable(true);
      return;
    }
    setUnreadable(false);
    setText(parsed);
    if (parsed !== current) emit(parsed);
  };

  const emit = (next: string) => {
    if (!controlled) setInner(next);
    setSeen(next);
    onChange?.(valueEvent(next, name));
  };

  return (
    <FieldShell
      {...{
        label,
        help,
        error: shownError,
        className,
        inputId,
        helpId,
        errorId,
        grouped,
        groupErrorId: unreadable ? undefined : groupErrorId,
      }}
      always
      ownError={unreadable}
    >
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <input
        type="text"
        id={inputId}
        className="campo__input"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => {
          setText(event.target.value);
          if (unreadable) setUnreadable(false);
        }}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") commit();
          onKeyDown?.(event);
        }}
        {...described}
      />
    </FieldShell>
  );
}
