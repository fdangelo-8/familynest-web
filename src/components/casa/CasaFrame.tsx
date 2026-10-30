import type { ReactNode, Ref } from "react";
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
  /** Shows the loading skeletons instead of the columns */
  loading?: boolean;
  /** Rendered after the columns, still inside `main` (live regions) */
  after?: ReactNode;
  mainRef?: Ref<HTMLElement>;
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
      {filter && !loading && current === "da-fare" ? (
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
