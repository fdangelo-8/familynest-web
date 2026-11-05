"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  isSearchable,
  searchHousehold,
  type SearchHit,
  type SearchQuery,
} from "@/lib/search-household";
import {
  parseSearchText,
  toSearchQuery,
  type SearchMember,
} from "./parse-query";

/** Wait after the last letter before asking the database. */
export const SEARCH_DEBOUNCE_MS = 250;

export type SearchPhase = "idle" | "loading" | "ready" | "error" | "offline";

type Done = {
  /** The request this answer belongs to */
  base: string;
  /** Changes with «Riprova» and with the connection coming back */
  retryTick: number;
  onlineTick: number;
  phase: "ready" | "error" | "offline";
  hits: SearchHit[];
  words: string[];
  /** The text typed when the answer arrived (for the hidden announcement) */
  text: string;
  /** The moment the answer arrived: the day the rows are worded from */
  now: Date;
  /** Increases at every answer: rows depend on it (selection, boxes ticked) */
  version: number;
};

export type SearchState = {
  phase: SearchPhase;
  /** Hits of the last answer, to be shown only when `phase` is `ready` */
  hits: SearchHit[];
  words: string[];
  version: number;
  /** The moment of the last answer */
  now: Date;
  /** Text of the last good answer, null if the last answer was not one */
  announcedText: string | null;
  /** «Riprova» is running: the error stays, its button is busy */
  retrying: boolean;
  retry: () => void;
};

const NOTHING: SearchHit[] = [];
const EPOCH = new Date(0);
const NO_WORDS: string[] = [];

/**
 * Asks the database for what is typed (issue #40, §5):
 * - nothing is asked for fewer than 2 characters;
 * - the request leaves 250 ms after the last letter (at once when
 *   `immediateRef.current` is true: an example or a recent search was tapped);
 * - only the answer for the text now in the field counts;
 * - the text goes only in the body of the request, and no error carries it.
 */
export function useSearch({
  text,
  people,
  ready,
  immediateRef,
}: {
  text: string;
  people: readonly SearchMember[];
  /** The people are known (or could not be read): expressions can be read */
  ready: boolean;
  immediateRef: MutableRefObject<boolean>;
}): SearchState {
  const [done, setDone] = useState<Done | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [onlineTick, setOnlineTick] = useState(0);
  const versionRef = useRef(0);
  const textRef = useRef(text);
  const phaseRef = useRef<SearchState["phase"]>("idle");

  // What to ask, as a text: the effect depends on the request, not on every
  // render. Dates are read when the text changes.
  const base = useMemo(() => {
    const compact = text.replace(/\s/g, "");
    if (!ready || compact.length < 2) return null;
    const query = toSearchQuery(parseSearchText(text, people, new Date()));
    return isSearchable(query) ? JSON.stringify(query) : null;
  }, [text, people, ready]);

  const current =
    done !== null && done.base === base && done.onlineTick === onlineTick
      ? done
      : null;

  let phase: SearchPhase;
  let retrying = false;
  if (base === null) {
    phase = "idle";
  } else if (current === null) {
    phase = "loading";
  } else if (current.retryTick === retryTick) {
    phase = current.phase;
  } else {
    // «Riprova» was tapped: the error stays until the new answer.
    phase = current.phase;
    retrying = true;
  }

  useEffect(() => {
    phaseRef.current = phase;
    textRef.current = text;
  });

  useEffect(() => {
    if (base === null) return;
    let cancelled = false;
    const query = JSON.parse(base) as SearchQuery;
    const words = query.text ? query.text.split(" ") : NO_WORDS;
    const delay = immediateRef.current ? 0 : SEARCH_DEBOUNCE_MS;
    immediateRef.current = false;

    const finish = (phaseDone: Done["phase"], hits: SearchHit[]): void => {
      versionRef.current += 1;
      setDone({
        base,
        retryTick,
        onlineTick,
        phase: phaseDone,
        hits,
        words,
        text: textRef.current,
        now: new Date(),
        version: versionRef.current,
      });
    };

    const timer = window.setTimeout(() => {
      if (!navigator.onLine) {
        finish("offline", NOTHING);
        return;
      }
      void searchHousehold(query).then((result) => {
        if (cancelled) return;
        if (result.ok) finish("ready", result.hits);
        else finish(navigator.onLine ? "error" : "offline", NOTHING);
      });
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [base, retryTick, onlineTick, immediateRef]);

  // The connection comes back: an offline notice goes away and the search
  // restarts by itself.
  useEffect(() => {
    const onOnline = () => {
      if (phaseRef.current === "offline") {
        immediateRef.current = true;
        setOnlineTick((value) => value + 1);
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [immediateRef]);

  const retry = useCallback(() => {
    immediateRef.current = true;
    setRetryTick((value) => value + 1);
  }, [immediateRef]);

  return {
    phase,
    hits: current?.hits ?? done?.hits ?? NOTHING,
    words: current?.words ?? done?.words ?? NO_WORDS,
    version: current?.version ?? done?.version ?? 0,
    now: current?.now ?? done?.now ?? EPOCH,
    announcedText:
      (current ?? done)?.phase === "ready" ? (current ?? done)!.text : null,
    retrying,
    retry,
  };
}
