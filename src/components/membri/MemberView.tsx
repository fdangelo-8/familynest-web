"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  removeMember,
  sendInvitation,
  setAdmin,
  type Failure,
} from "@/app/(app)/membri/[id]/actions";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar, type MemberColor } from "@/components/ui/Avatar/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { Toggle } from "@/components/ui/Toggle/Toggle";
import { buildInviteLink } from "@/lib/invitations";
import { shareOrCopy } from "./share-link";
import { FOCUS_INVITE_KEY } from "./texts";

export type ValidInvite = { token: string; expiresText: string };

export type MemberViewProps = {
  id: string;
  name: string;
  color: MemberColor;
  kind: "adult" | "pet";
  /** Line under the name, already written by the server */
  subtitle: string;
  /** The viewer is an administrator: invitation, role and «Togli» are shown */
  canManage: boolean;
  /** The member has an account (an adult who accepted an invitation) */
  hasAccount: boolean;
  /** The member is an administrator */
  isAdmin: boolean;
  /** Valid invitation, only for an administrator looking at an adult without account */
  invite: ValidInvite | null;
};

const ROLE_HELP_ID = "ruolo-aiuto";

const PREPARE_ERROR: Record<Failure, string> = {
  network:
    "Non siamo riusciti a preparare l'invito. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a preparare l'invito per un problema nostro. Riprova tra qualche minuto.",
};

const ROLE_ERROR: Record<Failure, string> = {
  network:
    "Non siamo riusciti a cambiare il ruolo. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a cambiare il ruolo per un problema nostro. Riprova tra qualche minuto.",
};

const removeError = (name: string): Record<Failure, string> => ({
  network: `Non siamo riusciti a togliere ${name}. Controlla la connessione e riprova.`,
  server: `Non siamo riusciti a togliere ${name} per un problema nostro. Riprova tra qualche minuto.`,
});

const failureIcon = (failure: Failure) =>
  failure === "network" ? ("wifi-off" as const) : ("circle-alert" as const);

/**
 * Content of the page of a member (mockup 29): head, invitation, role and
 * «Togli». Renders a fragment: every block is a direct child of `.colonna`.
 * Everything the browser gets here is already limited by the server.
 */
export function MemberView({
  id,
  name,
  color,
  kind,
  subtitle: initialSubtitle,
  canManage,
  hasAccount,
  isAdmin,
  invite: initialInvite,
}: MemberViewProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [invite, setInvite] = useState(initialInvite);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [inviteError, setInviteError] = useState<Failure | null>(null);
  const inviteRef = useRef<HTMLButtonElement>(null);

  const [admin, setAdminState] = useState(isAdmin);
  const [roleBusy, setRoleBusy] = useState(false);
  const roleBusyRef = useRef(false);
  const [roleError, setRoleError] = useState<Failure | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [removalError, setRemovalError] = useState<Failure | null>(null);

  // Arriving from «Invita qualcuno» -> «Continua»: the focus goes once to the invitation row.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FOCUS_INVITE_KEY) === id) {
        sessionStorage.removeItem(FOCUS_INVITE_KEY);
        inviteRef.current?.focus();
      }
    } catch {
      // No storage: the focus stays where the browser puts it.
    }
  }, [id]);

  const showInvite = canManage && kind === "adult" && !hasAccount;
  const showRole = canManage && kind === "adult";

  async function share(token: string, fresh: boolean) {
    const outcome = await shareOrCopy(
      buildInviteLink(window.location.origin, token),
    );
    if (outcome === "aborted") return;
    if (outcome === "shared") {
      showToast(
        fresh
          ? {
              text: "Invito mandato a",
              emphasis: name,
              after: ".",
              icon: "send",
              withoutNav: true,
            }
          : {
              text: "Invito mandato di nuovo a",
              emphasis: name,
              after: ".",
              icon: "send",
              withoutNav: true,
            },
      );
    } else if (outcome === "copied") {
      showToast({
        text: `Link copiato. Mandalo a ${name} dove preferisci.`,
        withoutNav: true,
      });
    } else if (fresh) {
      showToast({
        text: `L'invito per ${name} è pronto: tocca «Manda di nuovo l'invito» per mandarlo.`,
        withoutNav: true,
      });
    } else {
      showToast({
        text: "Non siamo riusciti a copiare il link. Riprova.",
        icon: null,
        withoutNav: true,
      });
    }
  }

  async function onInviteClick() {
    if (invite) {
      await share(invite.token, false);
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setInviteError(null);

    let result: Awaited<ReturnType<typeof sendInvitation>>;
    try {
      result = await sendInvitation(id);
    } catch {
      result = { ok: false, reason: "network" };
    }
    sendingRef.current = false;
    setSending(false);

    if (!result.ok) {
      setInviteError(result.reason);
      return;
    }
    setInvite({ token: result.token, expiresText: result.expiresText });
    setSubtitle(result.subtitle);
    inviteRef.current?.focus();
    await share(result.token, true);
    inviteRef.current?.focus();
  }

  async function onRoleChange(next: boolean) {
    if (roleBusyRef.current) return;
    roleBusyRef.current = true;
    setRoleBusy(true);
    setRoleError(null);
    setAdminState(next);

    let result: Awaited<ReturnType<typeof setAdmin>>;
    try {
      result = await setAdmin(id, next);
    } catch {
      result = { ok: false, reason: "network" };
    }
    if (!result.ok) {
      setAdminState(!next);
      setRoleError(result.reason);
    }
    roleBusyRef.current = false;
    setRoleBusy(false);
  }

  async function onRemove() {
    if (removingRef.current) return;
    removingRef.current = true;
    setRemoving(true);
    setRemovalError(null);

    let result: Awaited<ReturnType<typeof removeMember>>;
    try {
      result = await removeMember(id);
    } catch {
      result = { ok: false, reason: "network" };
    }
    if (!result.ok) {
      removingRef.current = false;
      setRemoving(false);
      setRemovalError(result.reason);
      return;
    }
    // The toast lives in the layout: it stays after the page changes.
    showToast({
      lead: name,
      text: "non è più nel Nest.",
      withoutNav: true,
    });
    // `replace`: going back never returns to the page of someone who is gone.
    router.replace("/nest");
  }

  const roleHelp = !hasAccount
    ? "Potrà diventarlo dopo aver accettato l'invito."
    : null;

  return (
    <>
      <div className="profilo-testa profilo-testa--riga">
        <Avatar name={name} color={color} size="xl" nameShown />
        <div className="intestazione">
          <h1 className="t-titolo-pagina">{name}</h1>
          <p className="intestazione__sotto">{subtitle}</p>
        </div>
      </div>

      {showInvite ? (
        <div className="sezione">
          <ul className="scheda lista">
            <li>
              <button
                ref={inviteRef}
                type="button"
                className={cx(
                  "riga-lista riga-lista--cliccabile",
                  sending && "is-caricamento",
                )}
                aria-busy={sending || undefined}
                aria-disabled={sending || undefined}
                onClick={() => void onInviteClick()}
              >
                <span className="icona-riquadro">
                  <Icon name="send" />
                </span>
                <span className="riga-lista__testo">
                  <span className="riga-lista__titolo">
                    {invite ? "Manda di nuovo l'invito" : "Manda l'invito"}
                  </span>
                  <span className="riga-lista__info">
                    {invite ? invite.expiresText : "Il link vale 7 giorni"}
                  </span>
                </span>
                <span className="riga-lista__valore">
                  {sending ? <Spinner /> : <Icon name="chevron-right" />}
                </span>
              </button>
            </li>
          </ul>
          {inviteError ? (
            <Alert variant="errore" icon={failureIcon(inviteError)}>
              {PREPARE_ERROR[inviteError]}
            </Alert>
          ) : null}
          <p className="t-nota t-secondario">
            {`Entrando, ${name} vedrà quello che è condiviso con tutto il Nest. Le cose «Solo io» degli altri restano private.`}
          </p>
        </div>
      ) : null}

      {showRole ? (
        <section className="sezione" aria-labelledby="ruolo-titolo">
          <div className="sezione__testa">
            <h2 className="sezione__titolo" id="ruolo-titolo">
              Ruolo
            </h2>
          </div>
          <ul className="scheda lista">
            <li className="riga-lista" aria-busy={roleBusy || undefined}>
              <span className="icona-riquadro">
                <Icon name="shield" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Amministratore</span>
                <span className="riga-lista__info">
                  Può invitare, togliere persone e gestire il piano
                </span>
              </span>
              <Toggle
                checked={admin}
                disabled={!hasAccount}
                aria-label="Amministratore"
                aria-describedby={roleHelp ? ROLE_HELP_ID : undefined}
                onChange={(next) => void onRoleChange(next)}
              />
            </li>
          </ul>
          {roleHelp ? (
            <p className="t-nota t-secondario" id={ROLE_HELP_ID}>
              {roleHelp}
            </p>
          ) : null}
          {roleError ? (
            <Alert variant="errore" icon={failureIcon(roleError)}>
              {ROLE_ERROR[roleError]}
            </Alert>
          ) : null}
        </section>
      ) : null}

      {canManage ? (
        <>
          {removalError ? (
            <Alert variant="errore" icon={failureIcon(removalError)}>
              {removeError(name)[removalError]}
            </Alert>
          ) : null}
          {/* `Button` has no `aria-haspopup`: same markup, written here */}
          <button
            type="button"
            className={cx("btn-pericolo", removing && "is-caricamento")}
            aria-haspopup="dialog"
            aria-busy={removing || undefined}
            aria-disabled={removing || undefined}
            onClick={() => {
              if (!removing) setConfirming(true);
            }}
          >
            {removing ? <Spinner /> : null}
            <span className="btn__testo">{`Togli ${name} dal Nest`}</span>
          </button>
          <ConfirmDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            title={`Togliere ${name} dal Nest?`}
            text={
              kind === "adult"
                ? `${name} non vedrà più la casa. Le cose che ha aggiunto restano; quelle «Solo io» vengono cancellate.`
                : `${name} non comparirà più negli impegni e nelle cose da fare. Gli impegni e le cose da fare restano.`
            }
            actions={[
              {
                label: `Togli ${name}`,
                variant: "pericolo-pieno",
                onClick: () => void onRemove(),
              },
            ]}
          />
        </>
      ) : null}
    </>
  );
}
