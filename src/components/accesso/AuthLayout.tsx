import type { FormEventHandler, ReactNode, Ref } from "react";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import styles from "./accesso.module.css";
import { BackLink, Brand, Claim, Stickers } from "./parts";

export type AuthFormProps = {
  id: string;
  /** Route that answers a native submit (before the scripts have loaded) */
  action: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

/** «Torna all'accesso»: only on the split screen, where there is no arrow. */
export function ToAccessLink({ href = "/accesso" }: { href?: string }) {
  return (
    <Button variant="link" href={href} className={styles.desktopOnly}>
      Torna all&apos;accesso
    </Button>
  );
}

/** Same link alone in its row (the row disappears with it below 1024 px). */
export function ToAccessRow({ href }: { href?: string }) {
  return (
    <div className={cx("gruppo-chip", styles.desktopOnly)}>
      <ToAccessLink href={href} />
    </div>
  );
}

/** Eyebrow, title and sentence under it. */
export function Intro({
  eyebrow,
  title,
  titleRef,
  children,
}: {
  eyebrow: string;
  title: string;
  /** The title takes the focus when the screen changes (C and T) */
  titleRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}) {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">{eyebrow}</p>
      <h1
        ref={titleRef}
        tabIndex={titleRef ? -1 : undefined}
        className="intestazione__titolo t-titolo-pagina"
      >
        {title}
      </h1>
      {children ? <p className="intestazione__sotto">{children}</p> : null}
    </div>
  );
}

/**
 * Frame of the mail and password screens (#327). One DOM for both sizes: the
 * light step is a column below 1024 px and the right half of the split screen
 * from 1024 px, where the night panel appears beside it. The `<form>` and its
 * fields exist once: password managers must not meet a hidden copy.
 */
export function AuthLayout({
  back,
  intro,
  body,
  actions,
  legal,
  form,
}: {
  /** Target of the mobile arrow; `null` = no way back (the person is in) */
  back: string | null;
  intro: ReactNode;
  /** Above the buttons: notices, fields, lists */
  body: ReactNode;
  /** Buttons and links at the bottom */
  actions: ReactNode;
  /** Legal sentence (`<p>`), under the buttons */
  legal?: ReactNode;
  /** With it the block is a real `<form>`, without it a plain block */
  form?: AuthFormProps;
}) {
  const inner = (
    <>
      <div className="sezione">{body}</div>
      <div className="dialogo__azioni">{actions}</div>
    </>
  );
  return (
    <main className={styles.root}>
      <div className={styles.layout}>
        <div className={cx("split-onboarding__notte", styles.panel)}>
          <Brand />
          <Stickers />
          <Claim as="p" />
        </div>
        <div className={cx("passo-onboarding", styles.step)}>
          <div className={cx("passo-onboarding__testa", styles.head)}>
            {back ? <BackLink href={back} /> : <span aria-hidden="true" />}
            <span aria-hidden="true" />
            <span className="barra__vuoto" aria-hidden="true" />
          </div>
          <div className={styles.mid}>
            {intro}
            {form ? (
              <form
                method="post"
                action={form.action}
                id={form.id}
                className={styles.block}
                noValidate
                onSubmit={form.onSubmit}
              >
                {inner}
              </form>
            ) : (
              <div className={styles.block}>{inner}</div>
            )}
          </div>
          {legal ? <div className={styles.legal}>{legal}</div> : null}
        </div>
      </div>
    </main>
  );
}
