"use client";

import { Brand } from "@/components/accesso/parts";
import styles from "@/components/accesso/accesso.module.css";
import { Button } from "@/components/ui/Button/Button";

export type InviteEndedKind = "expired" | "other-nest";

const CONTENT = {
  expired: {
    lead: "Questo invito",
    emphasis: "non vale più.",
    desktopTitle: "Invito non più valido",
    text: "Chiedi a chi ti ha mandato il link di invitarti di nuovo: dal suo FamilyNest bastano due tocchi.",
    action: "Entra in FamilyNest",
    href: "/accesso",
  },
  "other-nest": {
    lead: "Sei già",
    emphasis: "in un altro Nest.",
    desktopTitle: "Già in un altro Nest",
    text: "Con un account per ora si sta in un solo Nest. Il Nest in cui sei resta com'è.",
    action: "Vai a Oggi",
    href: "/oggi",
  },
} as const;

/**
 * The invitation cannot be used (mockup 07, error state) or the person is
 * already in another Nest. Nothing of the Nest of the invitation is shown:
 * no name, no avatar, no sign-in buttons.
 */
export function InviteEnded({ kind }: { kind: InviteEndedKind }) {
  const content = CONTENT[kind];
  const title = (
    <>
      {content.lead}
      <br />
      <b>{content.emphasis}</b>
    </>
  );

  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <div className="sezione">
          <h1 className="t-display claim">{title}</h1>
          <p className="citazione">{content.text}</p>
        </div>
        <div className="dialogo__azioni">
          <Button variant="chiaro" full href={content.href}>
            {content.action}
          </Button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <div className="sezione">
            <p className="t-display claim">{title}</p>
            <p className="citazione">{content.text}</p>
          </div>
          <span />
        </div>
        <div className="split-onboarding__passo">
          <span />
          <div className="sezione">
            <div className="intestazione">
              <h1 className="intestazione__titolo t-titolo-pagina">
                {content.desktopTitle}
              </h1>
            </div>
            <div className="dialogo__azioni">
              <Button variant="secondary" href={content.href}>
                {content.action}
              </Button>
            </div>
          </div>
          <span />
        </div>
      </div>
    </main>
  );
}
