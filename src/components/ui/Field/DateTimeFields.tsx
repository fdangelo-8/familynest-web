"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
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
import { Button } from "../Button/Button";
import { useEscapeLayer, useIsDesktop } from "../overlay";
import { Sheet } from "../Sheet/Sheet";
import type { TextFieldProps } from "./Field";
import { FieldShell, useFieldIds } from "./FieldShell";

export type DateFieldProps = Omit<TextFieldProps, "type" | "multiline"> & {
  /** Goes to the button (date) or to the input (time) */
  "data-testid"?: string;
  /**
   * Date only. The field may stay empty: with a value, the calendar shows
   * «Togli la data» under the grid. The page passes it only where the column
   * accepts an empty value; it is never worked out from `required`.
   */
  clearable?: boolean;
};

/** Space kept between the calendar box and the edge of the window, in px. */
const EDGE = 8;

// The clock never needs to be watched: the day is read when the field draws.
function subscribeNever() {
  return () => {};
}

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
  clearable = false,
  "data-testid": testId,
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
  const windowShape = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inactive = Boolean(disabled || readOnly);

  // «Today» is read in the browser only: the server has no clock to show, so
  // the first paint has no year and the right text follows at once.
  const today = useSyncExternalStore(
    subscribeNever,
    () => todayKeyInRome(),
    () => null,
  );
  const text = shownDay ? formatFieldDay(shownDay, today ?? shownDay) : "";
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
    // The box follows the field when the page or a modal scrolls.
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, windowShape]);

  // The focus goes to the day; a tap outside closes.
  useEffect(() => {
    if (!open || !windowShape) return;
    boxRef.current
      ?.querySelector<HTMLElement>("[data-autofocus]")
      ?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeBox(false);
      // The focus goes back to the field, unless the tap landed on another
      // control that took it (the browser moves it after this event).
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) triggerRef.current?.focus();
      }, 0);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
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

  // «Togli la data»: the value becomes empty once, the calendar closes and the
  // focus goes back to the field.
  const clear = () => {
    if (!controlled) setInner("");
    onChange?.(valueEvent("", name));
    if (windowShape) closeBox(true);
    else setClosing(true);
  };

  const clearButton =
    clearable && shownDay !== "" && !inactive ? (
      <Button
        variant="link-secondario"
        className="calendario-scelta__togli"
        onClick={clear}
        data-testid="calendario-togli"
      >
        {it.sheetsDates.clearDate}
      </Button>
    ) : null;

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
        data-testid={testId}
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
              aria-modal="true"
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
                data-testid="calendario"
              />
              {clearButton}
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
          data-testid="calendario"
        />
        {clearButton}
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
  "data-testid": testId,
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
        data-testid={testId}
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
