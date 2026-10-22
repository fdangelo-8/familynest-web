import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon/Icon";
import styles from "./accesso.module.css";

export const metadata: Metadata = {
  title: "FamilyNest · Accesso",
};

const DOTS = ["pomodoro", "glicine", "salvia", "cobalto"] as const;
const SOON = "L'accesso con Apple, Google e la mail è in arrivo.";

function Brand() {
  return (
    <p className="marchio">
      <span className="quadrato-nest quadrato-nest--notte" aria-hidden="true">
        {DOTS.map((color) => (
          <span
            key={color}
            className={`quadrato-nest__punto membro-${color}`}
          />
        ))}
      </span>
      FamilyNest
    </p>
  );
}

function Claim() {
  return (
    <p className="t-display claim">
      La casa,
      <br />
      <b>in un posto solo.</b>
    </p>
  );
}

// Placeholder until the real login (#11). Two layouts in one <main>: only one
// is displayed at a time, so there is a single visible h1.
export default function AccessoPage() {
  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <Claim />
        <div className="sezione">
          <h1 className="t-titolo-pagina">Accesso</h1>
          <ul className="lista lista--notte">
            <li className="riga-lista riga-lista--notte">
              <Icon name="hourglass" />
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">{SOON}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding`}>
        <div className="split-onboarding__notte">
          <Brand />
          <span />
          <Claim />
        </div>
        <div className="split-onboarding__passo">
          <span />
          <div className="sezione">
            <div className="intestazione">
              <p className="intestazione__sopra">Benvenuto</p>
              <h1 className="intestazione__titolo t-titolo-pagina">Accesso</h1>
              <p className="intestazione__sotto">
                {SOON} Stiamo preparando questa pagina.
              </p>
            </div>
            <span className="etichetta">
              <Icon name="hourglass" size="s" />
              In arrivo
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
