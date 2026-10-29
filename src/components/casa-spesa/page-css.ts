/**
 * Layout rules of the Spesa page only, tokens only. They are a <style>
 * element and not a CSS module on purpose: a streamed stylesheet makes React
 * wait before swapping the loading state for the page, and for a moment the
 * document has two <main>. Move them to components.css with the next shared
 * change.
 */
export const SPESA_PAGE_CSS = `
@media (min-width: 1024px) {
  .spesa-selettore,
  .spesa-solo-mobile {
    display: none;
  }
}
@media (max-width: 1023px) {
  .spesa-solo-desktop {
    display: none;
  }
  .spesa-testa-colonna {
    position: absolute;
    width: var(--border-sottile);
    height: var(--border-sottile);
    min-height: var(--space-0);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
`;
