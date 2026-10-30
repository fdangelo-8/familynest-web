"use client";

import Link from "next/link";
import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import styles from "./onboarding.module.css";
import { Steps } from "./Steps";

const BACK = "/onboarding/persone";

function Placeholder() {
  return (
    <>
      <div className="intestazione">
        <p className="intestazione__sopra">Ultimo passo</p>
        <Skeleton shape="titolo" />
      </div>
      <Skeleton shape="testo" />
    </>
  );
}

/**
 * Shown while the page reads the invitation: head, steps and "Ultimo passo"
 * are real, title and note are skeletons and the buttons wait. A client
 * component because `Button` builds its click handler.
 */
export function InviteSkeleton() {
  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <Link
            href={BACK}
            prefetch={false}
            className="btn-icona"
            aria-label="Indietro"
          >
            <Icon name="arrow-left" />
          </Link>
          <Steps current={4} total={4} />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        <SkeletonGroup className="sezione">
          <Placeholder />
        </SkeletonGroup>
        <div className="dialogo__azioni">
          <Button icon="send" full disabled>
            Manda il link
          </Button>
          <Button variant="secondary" icon="copy" full disabled>
            Copia il link
          </Button>
          <button
            type="button"
            className="btn-link btn-link--secondario"
            disabled
          >
            Lo faccio dopo
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
          <Steps current={4} total={4} />
          <SkeletonGroup className="sezione">
            <Placeholder />
            <div className="campo-doppio">
              <Button icon="send" disabled>
                Manda il link
              </Button>
              <Button variant="secondary" icon="copy" disabled>
                Copia il link
              </Button>
            </div>
          </SkeletonGroup>
          <div className="modale__piede">
            <Link
              href={BACK}
              prefetch={false}
              className="btn-link btn-link--secondario"
            >
              Indietro
            </Link>
            <Button disabled>Ho finito</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
