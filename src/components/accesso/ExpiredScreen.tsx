import Link from "next/link";
import styles from "./accesso.module.css";
import { Brand } from "./parts";

export type ExpiredKind = "conferma" | "password";

const COPY: Record<
  ExpiredKind,
  { citation: string; action: string; href: string }
> = {
  conferma: {
    citation:
      "I link nelle nostre mail valgono un'ora, si usano una volta sola e funzionano solo nel browser in cui li hai chiesti. Entra con mail e password: se l'indirizzo non è ancora confermato, potrai farti mandare una nuova mail da aprire qui.",
    action: "Entra con la mail",
    href: "/accesso/mail",
  },
  password: {
    citation:
      "Il link per scegliere una nuova password vale un'ora, si usa una volta sola e funziona solo nel browser in cui l'hai chiesto. Chiedine uno nuovo e aprilo qui.",
    action: "Mandami un nuovo link",
    href: "/accesso/password-dimenticata",
  },
};

function ExpiredClaim({ as: Tag }: { as: "h1" | "p" }) {
  return (
    <Tag className="t-display claim">
      Questo link
      <br />
      <b>non vale più.</b>
    </Tag>
  );
}

/**
 * `/accesso/link-scaduto`: one screen for a link that is expired, already used
 * or not valid (Supabase does not tell them apart reliably). The text depends
 * on which link it was: the confirmation of the address or the new password.
 */
export function ExpiredScreen({ kind }: { kind: ExpiredKind }) {
  const { citation, action, href } = COPY[kind];
  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <div className="sezione">
          <ExpiredClaim as="h1" />
          <p className="citazione">{citation}</p>
        </div>
        <div className="dialogo__azioni">
          <Link href={href} className="btn-chiaro btn--pieno">
            <span className="btn__testo">{action}</span>
          </Link>
          <div className="gruppo-chip">
            <Link href="/accesso" className="btn-link">
              <span className="btn__testo">Torna all&apos;accesso</span>
            </Link>
          </div>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <div className="sezione">
            <ExpiredClaim as="p" />
            <p className="citazione">{citation}</p>
          </div>
          <span />
        </div>
        <div className="split-onboarding__passo">
          <span />
          <div className="sezione">
            <div className="intestazione">
              <p className="intestazione__sopra">Accesso con la mail</p>
              <h1 className="intestazione__titolo t-titolo-pagina">
                Link non più valido
              </h1>
            </div>
            <div className="dialogo__azioni">
              <Link href={href} className="btn-secondary">
                <span className="btn__testo">{action}</span>
              </Link>
              <div className="gruppo-chip">
                <Link href="/accesso" className="btn-link">
                  <span className="btn__testo">Torna all&apos;accesso</span>
                </Link>
              </div>
            </div>
          </div>
          <span />
        </div>
      </div>
    </main>
  );
}
