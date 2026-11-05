import { PublicSkeleton } from "@/components/desideri/PublicSkeleton";

/** The shape of the public page while it opens: nothing of the list yet. */
export default function Loading() {
  return (
    <div className="cornice-pubblica">
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        <PublicSkeleton />
      </main>
    </div>
  );
}
