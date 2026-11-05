"use client";

import { Brand, Claim, Stickers } from "@/components/accesso/parts";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import styles from "./onboarding.module.css";

const ASSURANCES = [
  {
    icon: "eye-off",
    title: "Gli altri vedono solo che sei occupato",
    text: "Mai il titolo né il luogo dei tuoi impegni di lavoro.",
  },
  {
    icon: "repeat",
    title: "In due direzioni",
    text: "Quello che aggiungi qui può andare anche lì, e viceversa.",
  },
  {
    icon: "sliders-horizontal",
    title: "Scegli dopo cosa tenere",
    text: "Da Impostazioni › Calendari collegati.",
  },
] as const;

function Heading() {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">Le tue giornate</p>
      <h1 className="intestazione__titolo t-titolo-pagina">
        Porta qui il tuo calendario
      </h1>
    </div>
  );
}

function Providers() {
  return (
    <SkeletonGroup>
      <Skeleton shape="riga" />
      <Skeleton shape="riga" />
    </SkeletonGroup>
  );
}

function Assurances() {
  return (
    <ul className="scheda lista">
      {ASSURANCES.map((item) => (
        <li key={item.title} className="riga-lista">
          <span className="icona-riquadro">
            <Icon name={item.icon} />
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{item.title}</span>
            <span className="riga-lista__info">{item.text}</span>
          </span>
        </li>
      ))}
    </ul>
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
