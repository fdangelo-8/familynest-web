import { PageError } from "@/components/ui/PageError/PageError";

// Outside the app frame: no bar, no navigation (public area, decision D2).
export default function NotFound() {
  return (
    <div className="cornice-pubblica">
      <main
        id="contenuto"
        tabIndex={-1}
        className="pagina pagina-desktop pagina-desktop--centrata"
      >
        <PageError
          headingLevel={1}
          title="Questa pagina non c’è"
          text="Il link potrebbe essere vecchio o scritto male."
          action={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      </main>
    </div>
  );
}
