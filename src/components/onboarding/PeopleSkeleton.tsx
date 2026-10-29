import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Icon } from "@/components/ui/Icon/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import styles from "./onboarding.module.css";
import { Steps } from "./Steps";

function Placeholder() {
  return (
    <>
      <SkeletonGroup>
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
      </SkeletonGroup>
      <button type="button" className="btn-tratteggiato" disabled>
        <Icon name="plus" />
        Aggiungi una persona o un animale
      </button>
    </>
  );
}

function Heading() {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">La tua famiglia</p>
      <h1 className="intestazione__titolo t-titolo-pagina">
        Chi c&apos;è nel Nest?
      </h1>
    </div>
  );
}

/**
 * Shown while the page reads the Nest: head, steps and heading are real, the
 * list is two skeleton rows and "Continua" waits (plain buttons: `Button` is
 * for client components). The step count is the
 * default (4): the real one arrives with the list.
 */
export function PeopleSkeleton() {
  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <span className="btn-icona" aria-hidden="true" />
          <Steps current={2} total={4} />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        <Heading />
        <div className="sezione">
          <Placeholder />
        </div>
        <div className="dialogo__azioni">
          <button type="button" className="btn-primary btn--pieno" disabled>
            <span className="btn__testo">Continua</span>
          </button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <Steps current={2} total={4} />
          <div className="sezione">
            <Heading />
            <Placeholder />
          </div>
          <div className="modale__piede">
            <span />
            <button type="button" className="btn-primary" disabled>
              <span className="btn__testo">Continua</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
