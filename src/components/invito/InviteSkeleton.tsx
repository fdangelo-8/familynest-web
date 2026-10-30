import { Brand } from "@/components/accesso/parts";
import styles from "@/components/accesso/accesso.module.css";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";

/**
 * Shown while `/invito` reads the invitation. It says nothing of the Nest and
 * does not hint at which state is coming: no heading, no spinner.
 */
export function InviteSkeleton() {
  return (
    <main className={styles.root} aria-busy="true">
      <VisuallyHidden>Caricamento in corso</VisuallyHidden>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <div className="sezione" aria-hidden="true">
          <Skeleton shape="cerchio" night />
          <Skeleton shape="titolo" night />
          <Skeleton shape="titolo" night />
        </div>
        <div className="dialogo__azioni" aria-hidden="true">
          <Skeleton shape="riga" night />
          <Skeleton shape="riga" night />
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <div className="sezione" aria-hidden="true">
            <Skeleton shape="cerchio" night />
            <Skeleton shape="titolo" night />
            <Skeleton shape="titolo" night />
          </div>
          <span />
        </div>
        <div className="split-onboarding__passo">
          <span />
          <div className="sezione" aria-hidden="true">
            <Skeleton shape="testo-corto" />
            <Skeleton shape="titolo" />
            <Skeleton shape="riga" />
            <Skeleton shape="riga" />
          </div>
          <span />
        </div>
      </div>
    </main>
  );
}
