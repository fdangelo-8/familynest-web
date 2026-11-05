import type { ReactNode } from "react";
import { PAGE_TITLE } from "./texts";

/**
 * Header of the page from 1024 px (`.intestazione-desktop`, hidden below):
 * the h1 and, on the right, «Segna tutte come lette». Below 1024 px the h1 is
 * the one of the top bar, so there is one visible h1 at every width.
 */
export function PageHeader({ children }: { children: ReactNode }) {
  return (
    <div className="intestazione-desktop">
      <h1 className="t-titolo-pagina">{PAGE_TITLE}</h1>
      {children}
    </div>
  );
}
