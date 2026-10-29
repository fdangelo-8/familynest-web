import Link from "next/link";
import { Icon } from "@/components/ui/Icon/Icon";

const DOTS = ["pomodoro", "glicine", "salvia", "cobalto"] as const;

export function Brand() {
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

/** Decorative stickers (decision D1: four, none health-related). */
export function Stickers() {
  return (
    <div className="adesivi" aria-hidden="true">
      <span className="adesivo membro-salvia">
        <span className="avatar membro-salvia" aria-hidden="true">
          S
        </span>
        Nuoto <span className="adesivo__nota">gio 17:00</span>
      </span>
      <span className="adesivo adesivo--destra membro-zafferano">
        <span className="adesivo__icona">
          <Icon name="shopping-basket" />
        </span>
        Latte e pane
      </span>
      <span className="adesivo adesivo--rientro adesivo--insieme membro-insieme">
        <span className="adesivo__icona">
          <Icon name="heart" />
        </span>
        Liberi insieme <span className="adesivo__nota">ven sera</span>
      </span>
      <span className="adesivo adesivo--destra membro-glicine">
        <span className="avatar membro-glicine" aria-hidden="true">
          L
        </span>
        Calcetto <span className="adesivo__nota">sab 10:00</span>
      </span>
    </div>
  );
}

/** Claim as a heading (mobile) or as a paragraph (desktop panel). */
export function Claim({ as: Tag }: { as: "h1" | "p" }) {
  return (
    <Tag className="t-display claim">
      La casa,
      <br />
      <b>in un posto solo.</b>
    </Tag>
  );
}

/** Legal sentence with the links to terms and privacy. */
export function LegalLine({ className }: { className: string }) {
  return (
    <p className={className}>
      Continuando accetti i{" "}
      <Link className="legale__link" href="/termini">
        Termini d&apos;uso
      </Link>{" "}
      e l&apos;
      <Link className="legale__link" href="/privacy">
        Informativa sulla privacy
      </Link>
      .
    </p>
  );
}

/** Link of the mobile header: back to the sign-in page. */
export function BackLink() {
  return (
    <Link href="/accesso" className="btn-icona" aria-label="Indietro">
      <Icon name="arrow-left" />
    </Link>
  );
}
