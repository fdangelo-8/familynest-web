import Link from "next/link";
import { Icon } from "@/components/ui/Icon/Icon";

export default function AppNotFound() {
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      <div className="errore-pagina">
        <span className="errore-pagina__icona">
          <Icon name="compass" />
        </span>
        <h1 className="errore-pagina__titolo">Questa pagina non c’è</h1>
        <p className="errore-pagina__testo">
          Il link potrebbe essere vecchio o scritto male.
        </p>
        <Link href="/oggi" className="btn-secondary btn--piccolo">
          <span className="btn__testo">Torna a Oggi</span>
        </Link>
      </div>
    </main>
  );
}
