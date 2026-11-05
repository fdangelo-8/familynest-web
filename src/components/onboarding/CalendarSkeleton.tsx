"use client";

import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Button } from "@/components/ui/Button/Button";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { Assurances, Heading } from "./CalendarParts";
import styles from "./onboarding.module.css";

function Providers() {
  return (
    <SkeletonGroup>
      <Skeleton shape="riga" />
      <Skeleton shape="riga" />
    </SkeletonGroup>
  );
}

/**
 * Shown while the page reads the linked accounts: title and assurances are
 * real, the provider rows are skeletons and the buttons wait. The steps and
 * the back arrow are not shown: they depend on who is here (administrator or
 * invited), which only the server knows. A client component because `Button`
 * builds its click handler.
 */
export function CalendarSkeleton() {
  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} passo-onboarding`}>
        <div className="passo-onboarding__testa">
          <span className="barra__vuoto" aria-hidden="true" />
          <span className="barra__vuoto" aria-hidden="true" />
          <span className="barra__vuoto" aria-hidden="true" />
        </div>
        <Heading />
        <div className="sezione">
          <Providers />
          <Assurances />
        </div>
        <div className="dialogo__azioni">
          <Button full disabled>
            Continua senza calendario
          </Button>
          <Button variant="link-secondario" disabled>
            Più tardi
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
          <span className="barra__vuoto" aria-hidden="true" />
          <div className="sezione">
            <Heading />
            <Providers />
            <Assurances />
          </div>
          <div className="modale__piede">
            <Button variant="link-secondario" disabled>
              Più tardi
            </Button>
            <Button disabled>Continua senza calendario</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
