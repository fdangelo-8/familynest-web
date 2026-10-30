import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { SectionSwitcher } from "@/components/ui/SegmentedControl/SectionSwitcher";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { PersonFilter, type PersonFilterProps } from "./PersonFilter";

export type CasaSection = "spesa" | "da-fare" | "scadenze";

export type CasaColumnOffline = {
  /** The column has changes waiting for the connection */
  active: boolean;
  /** "Riprova" is running for this column */
  retrying?: boolean;
  /** Sends the queue of this column again */
  onRetry: () => void;
};

export type CasaColumn = {
  /** Offline state: the frame shows one alert for all the columns */
  offline?: CasaColumnOffline;
  /** Shown on the right of the column title (desktop), for example "4 aperti" */
  info?: string;
  /**
   * The column shows its own read error (with "Riprova"). When it goes away
   * and the focus was on "Riprova", the frame moves it to the column title.
   */
  failed?: boolean;
  /**
   * Selectors, inside this column, of the places that take the focus when the
   * offline alert goes away with the focus on "Riprova": the first one that
   * is on screen wins; without any, the column title.
   */
  focusTargets?: ReadonlyArray<string>;
  children: ReactNode;
};

export type CasaFrameProps = {
  nestName: string;
  /** The page that is open: it is the only column visible below 1024 px */
  current: CasaSection;
  /** Numbers in the mobile switcher; 0 or absent = no number */
  counts?: Partial<Record<CasaSection, number>>;
  /** Columns that are ready; the others show the "In arrivo" placeholder */
  columns?: Partial<Record<CasaSection, CasaColumn>>;
  /** Person filter: one state, rendered once per layout. Absent = no chips. */
  filter?: PersonFilterProps;
  /** The chips are not drawn on mobile (they stay in the desktop header) */
  hideFilterOnMobile?: boolean;
  /** Shows the loading skeletons instead of the columns */
  loading?: boolean;
  /** Rendered after the columns, still inside `main` (live regions) */
  after?: ReactNode;
  /** The `main` of the page; the frame also reads it to move the focus */
  mainRef: RefObject<HTMLElement | null>;
};

const SECTIONS: ReadonlyArray<{
  key: CasaSection;
  title: string;
  href: string;
  icon: "square-check" | "file-clock" | "shopping-basket";
  placeholder: string;
}> = [
  {
    key: "spesa",
    title: "Spesa",
    href: "/casa/spesa",
    icon: "shopping-basket",
    placeholder:
      "Qui ci sarà la spesa della casa. Stiamo preparando questa parte.",
  },
  {
    key: "da-fare",
    title: "Da fare",
    href: "/casa/da-fare",
    icon: "square-check",
    placeholder:
      "Qui ci saranno le cose da fare della casa. Stiamo preparando questa parte.",
  },
  {
    key: "scadenze",
    title: "Scadenze",
    href: "/casa/scadenze",
    icon: "file-clock",
    placeholder:
      "Qui ci saranno le scadenze della casa. Stiamo preparando questa parte.",
  },
];

function Skeletons({ current }: { current: CasaSection }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <VisuallyHidden>Caricamento in corso</VisuallyHidden>
      <div className="casa-solo-mobile">
        {current === "scadenze" ? (
          <div className="gruppo-skeleton" aria-hidden="true">
            <Skeleton shape="grande" />
          </div>
        ) : (
          <>
            <div className="gruppo-skeleton" aria-hidden="true">
              <Skeleton shape="riga" />
            </div>
            <div className="gruppo-skeleton" aria-hidden="true">
              <Skeleton shape="testo-corto" />
              <Skeleton shape="grande" />
            </div>
          </>
        )}
      </div>
      <div className={cx("colonne", "colonne--tre", "casa-solo-desktop")}>
        {[0, 1, 2].map((column) => (
          <div key={column} className="gruppo-skeleton" aria-hidden="true">
            <Skeleton shape="riga" />
            <Skeleton shape="grande" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Frame shared by /casa/spesa, /casa/da-fare and /casa/scadenze: desktop
 * header (Nest name, "Casa", person filter), section switcher on mobile, one
 * offline alert, and the three columns. Below 1024 px only the column of the
 * current page is visible, without its head.
 */
export function CasaFrame({
  nestName,
  current,
  counts,
  columns,
  filter,
  hideFilterOnMobile = false,
  loading = false,
  after,
  mainRef,
}: CasaFrameProps) {
  // One alert for the page. On mobile it shows only if the column of the open
  // page is offline; on desktop if any column is.
  const offlineColumns = SECTIONS.map((section) => ({
    key: section.key,
    offline: columns?.[section.key]?.offline,
  })).filter((column) => column.offline?.active);
  const retrying = offlineColumns.some((column) => column.offline?.retrying);
  const offlineAlert =
    offlineColumns.length > 0 ? (
      <Alert
        variant="errore"
        icon="wifi-off"
        className={cx(
          !offlineColumns.some((column) => column.key === current) &&
            "casa-solo-desktop",
        )}
        action={
          <Button
            variant="link"
            loading={retrying}
            onClick={() =>
              offlineColumns.forEach((column) => column.offline?.onRetry())
            }
          >
            Riprova
          </Button>
        }
      >
        Sei offline: le cose che spunti partiranno appena torna la connessione.
      </Alert>
    ) : null;

  // Did the focus sit on a "Riprova" of an alert the last time it moved?
  const focusInAlert = useRef(false);
  useEffect(() => {
    const track = (event: FocusEvent) => {
      focusInAlert.current =
        event.target instanceof Element && !!event.target.closest(".avviso");
    };
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, []);

  // What shows a "Riprova" now, to see which alert has just gone away.
  const offlineShown = offlineAlert !== null;
  const failedKeys = SECTIONS.filter(
    (section) => columns?.[section.key]?.failed,
  )
    .map((section) => section.key)
    .join(",");
  const currentTargets = columns?.[current]?.focusTargets?.join("|") ?? "";
  const before = useRef({ offline: false, failed: "" });
  useEffect(() => {
    // While the columns are not drawn nothing is compared.
    if (loading) return;
    const last = before.current;
    before.current = { offline: offlineShown, failed: failedKeys };
    if (!focusInAlert.current) return;
    const root = mainRef.current;
    if (!root) return;
    const visible = (selector: string, scope: Element) =>
      Array.from(scope.querySelectorAll<HTMLElement>(selector)).find(
        (element) => element.getClientRects().length > 0,
      );
    const column = (key: string) =>
      root.querySelector(`section[data-casa-column="${key}"]`);
    const stillFailed = failedKeys.split(",");
    const solved = last.failed
      .split(",")
      .find((key) => key !== "" && !stillFailed.includes(key));

    let target: HTMLElement | undefined;
    if (solved) {
      // The column error is gone: the focus goes to the title of the column.
      target = column(solved)?.querySelector<HTMLElement>("h2") ?? undefined;
      target?.setAttribute("tabindex", "-1");
    } else if (last.offline && !offlineShown) {
      // The offline alert is gone ("Riprova" with it): the focus goes to a
      // place of the open column. While any column is still offline the alert
      // stays, and so does the focus.
      const scope = column(current);
      if (scope) {
        for (const selector of currentTargets.split("|")) {
          if (selector === "") continue;
          target = visible(selector, scope);
          if (target) break;
        }
        if (!target) {
          target = scope.querySelector<HTMLElement>("h2") ?? undefined;
          target?.setAttribute("tabindex", "-1");
        }
      }
    }
    if (!target) return;
    focusInAlert.current = false;
    target.focus();
  }, [offlineShown, failedKeys, currentTargets, current, loading, mainRef]);

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      ref={mainRef}
      className="pagina pagina-desktop"
    >
      <div className="intestazione-desktop">
        <div className="intestazione">
          <p className="intestazione__sopra">{nestName}</p>
          <h1 className="intestazione__titolo t-titolo-pagina">Casa</h1>
        </div>
        {filter ? <PersonFilter layout="desktop" {...filter} /> : null}
      </div>
      <SectionSwitcher
        aria-label="Sezione della casa"
        items={SECTIONS.map((section) => ({
          key: section.key,
          label: section.title,
          href: section.href,
          count: counts?.[section.key],
        }))}
        current={current}
        className="casa-solo-mobile"
      />
      {offlineAlert}
      {filter && !loading && !hideFilterOnMobile ? (
        <PersonFilter layout="mobile" {...filter} />
      ) : null}
      {loading ? (
        <Skeletons current={current} />
      ) : (
        <div className="colonne colonne--tre">
          {SECTIONS.map((section) => {
            const column = columns?.[section.key];
            return (
              <section
                key={section.key}
                data-casa-column={section.key}
                className={cx(
                  "colonna",
                  section.key !== current && "casa-solo-desktop",
                )}
                aria-label={section.title}
              >
                <div className={cx("sezione__testa", "casa-testa-colonna")}>
                  <h2 className="sezione__titolo">{section.title}</h2>
                  {column?.info ? (
                    <span className="sezione__info">{column.info}</span>
                  ) : null}
                </div>
                {column ? (
                  column.children
                ) : (
                  <EmptyState
                    icon={section.icon}
                    title="In arrivo"
                    text={section.placeholder}
                    actions={null}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
      {after}
    </main>
  );
}
