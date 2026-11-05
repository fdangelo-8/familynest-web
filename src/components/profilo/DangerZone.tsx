"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { Button } from "@/components/ui/Button/Button";
import { getLeaveDialogCopy } from "@/lib/leave-dialog";
import { clearLens } from "@/lib/lens";
import { clearAllRecentSearches } from "@/lib/recent-searches";
import type { DeletionOutlook } from "./model";

const SIGN_OUT_TEXT = {
  title: "Uscire da FamilyNest?",
  text: "Su questo dispositivo dovrai accedere di nuovo. Le tue cose restano nel Nest.",
  error:
    "Non siamo riusciti a farti uscire. Controlla la connessione e riprova.",
};

/** Where the person lands after the deletion: a signal without personal data. */
const AFTER_DELETION = "/accesso?account=eliminato";

/** The action never ends: the dialog keeps its spinner until the page changes. */
const UNTIL_THE_PAGE_CHANGES = () => new Promise<void>(() => {});

function isOutlook(value: unknown): value is DeletionOutlook {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.isLastAdultWithAccount === "boolean" &&
    Array.isArray(v.remainingNames) &&
    v.remainingNames.every((n) => typeof n === "string") &&
    (v.newAdministratorName === null ||
      typeof v.newAdministratorName === "string")
  );
}

/**
 * «Esci» and «Elimina l'account», at the bottom of the page, each with its
 * confirmation dialog. Signing out and deleting are POSTs to routes of the
 * server, which decides who the person is from the session (nothing about the
 * account is sent). The text of the deletion follows what the database says
 * will happen to the Nest; if that changed since the page opened (FN003) the
 * dialog opens again with the new text and button.
 */
export function DangerZone({
  householdName,
  initialOutlook,
}: {
  householdName: string;
  initialOutlook: DeletionOutlook;
}) {
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | undefined>();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [outlook, setOutlook] = useState(initialOutlook);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  // Bumped to open the dialog again with the new text after FN003.
  const [dialogKey, setDialogKey] = useState(0);
  const outlookChanged = useRef(false);

  const copy = getLeaveDialogCopy({
    action: "delete-account",
    householdName,
    isLastAdultWithAccount: outlook.isLastAdultWithAccount,
    remainingNames: outlook.remainingNames,
    newAdministratorName: outlook.newAdministratorName,
  });

  async function signOut(): Promise<void | boolean> {
    setSignOutError(undefined);
    try {
      const response = await fetch("/auth/signout", {
        method: "POST",
        redirect: "manual",
        cache: "no-store",
      });
      // The route answers with a redirect to /accesso and deletes the cookies.
      if (response.type === "opaqueredirect" || response.ok) {
        // The recent searches stay in this browser only: they leave with the person.
        clearAllRecentSearches();
        clearLens();
        window.location.replace("/accesso");
        return UNTIL_THE_PAGE_CHANGES();
      }
    } catch {
      // Falls through: no answer from the server.
    }
    setSignOutError(SIGN_OUT_TEXT.error);
    return false;
  }

  async function deleteAccount(): Promise<void | boolean> {
    setDeleteError(undefined);
    let response: Response;
    try {
      response = await fetch("/profilo/elimina", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only what the dialog announced: who is deleted comes from the session.
        body: JSON.stringify({
          expectHouseholdDeletion: copy.deletesHousehold,
        }),
        cache: "no-store",
      });
    } catch {
      setDeleteError(copy.errorText.network);
      return false;
    }

    if (response.ok) {
      clearAllRecentSearches();
      clearLens();
      // `replace`: going back never returns to a page of an account that is gone.
      window.location.replace(AFTER_DELETION);
      return UNTIL_THE_PAGE_CHANGES();
    }

    if (response.status === 409) {
      try {
        const body: unknown = await response.json();
        const fresh =
          typeof body === "object" && body !== null
            ? (body as { outlook?: unknown }).outlook
            : null;
        if (isOutlook(fresh)) {
          setOutlook(fresh);
          outlookChanged.current = true;
          // Resolves: the dialog closes and `onClose` opens the new one.
          return;
        }
      } catch {
        // Falls through to the server message.
      }
    }
    setDeleteError(copy.errorText.server);
    return false;
  }

  return (
    <>
      <div className="dialogo__azioni">
        <Button
          variant="secondary"
          full
          icon="log-out"
          aria-haspopup="dialog"
          onClick={() => {
            setSignOutError(undefined);
            setSignOutOpen(true);
          }}
        >
          Esci
        </Button>
        <Button
          variant="pericolo"
          aria-haspopup="dialog"
          onClick={() => {
            setDeleteError(undefined);
            setDeleteOpen(true);
          }}
        >
          Elimina l&apos;account
        </Button>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title={SIGN_OUT_TEXT.title}
        text={SIGN_OUT_TEXT.text}
        errorText={signOutError}
        actions={[
          { label: "Esci", variant: "primary", onClick: () => signOut() },
        ]}
      />

      <ConfirmDialog
        key={dialogKey}
        open={deleteOpen}
        onClose={() => {
          if (outlookChanged.current) {
            outlookChanged.current = false;
            setDialogKey((key) => key + 1);
            return;
          }
          setDeleteOpen(false);
        }}
        title={copy.title}
        text={copy.text}
        errorText={deleteError}
        actions={[
          {
            label: copy.confirmLabel,
            variant: "pericolo-pieno",
            onClick: () => deleteAccount(),
          },
        ]}
      />
    </>
  );
}
