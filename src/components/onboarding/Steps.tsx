/** Step indicator of the onboarding: informative only, never focusable. */
export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="tacche-passi"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Passo ${current} di ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`tacche-passi__tacca${i < current ? " is-fatta" : ""}`}
        />
      ))}
    </div>
  );
}
