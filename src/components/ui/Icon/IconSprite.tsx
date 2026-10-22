import { ICON_PATHS } from "./icon-paths";

/** The single icon sprite of the app, rendered once in the root layout. */
export function IconSprite() {
  return (
    <svg className="sprite-icone" aria-hidden="true" focusable="false">
      {Object.entries(ICON_PATHS).map(([name, markup]) => (
        <symbol
          key={name}
          id={`i-${name}`}
          viewBox="0 0 24 24"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      ))}
    </svg>
  );
}
