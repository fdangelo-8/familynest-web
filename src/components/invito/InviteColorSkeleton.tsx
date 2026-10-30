"use client";

import Link from "next/link";
import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Steps } from "@/components/onboarding/Steps";
import styles from "@/components/onboarding/onboarding.module.css";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";

function CardSkeleton() {
  return (
    <div className="scheda anteprima-avatar" aria-hidden="true">
      <Skeleton shape="cerchio" />
      <Skeleton shape="titolo" />
      <Skeleton shape="testo" />
      <Skeleton shape="testo" />
    </div>
  );
}

/**
 * Shown while the colour page reads the invitation: head, steps and the title
 * (a fixed text) are real, the rest waits. A client component because
 * `Button` builds its click handler.
 */
export function InviteColorSkeleton() {
  return (
    <main className={styles.root} aria-busy="true">
      <VisuallyHidden>Caricamento in corso</VisuallyHidden>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <Link
            href="/invito"
            prefetch={false}
            className="btn-icona"
            aria-label="Indietro"
          >
            <Icon name="arrow-left" />
          </Link>
          <Steps current={1} total={3} />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        <div className="intestazione">
          <Skeleton shape="testo-corto" />
          <h1 className="intestazione__titolo t-titolo-pagina">
            Scegli il tuo colore
          </h1>
        </div>
        <div className="sezione">
          <CardSkeleton />
        </div>
        <div className="dialogo__azioni">
          <Button full disabled>
            Continua
          </Button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className="split-onboarding__passo">
          <Steps current={1} total={3} />
          <div className="sezione">
            <div className="intestazione">
              <Skeleton shape="testo-corto" />
              <h1 className="intestazione__titolo t-titolo-pagina">
                Scegli il tuo colore
              </h1>
            </div>
            <CardSkeleton />
          </div>
          <div className="modale__piede">
            <Link
              href="/invito"
              prefetch={false}
              className="btn-link btn-link--secondario"
            >
              Indietro
            </Link>
            <Button disabled>Continua</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
