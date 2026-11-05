"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { leaveHousehold } from "@/app/(app)/impostazioni/actions";
import { Button } from "@/components/ui/Button/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import {
  getLeaveButtonLabel,
  getLeaveDialogCopy,
  LEAVE_BLOCKED_NOTE,
} from "@/lib/leave-dialog";

/**
 * «Esci da …» with its confirmation. `blocked`: the caller is the only
 * administrator and another adult has an account, so the button is off and
 * a note says what to do. `lastAdult`: nobody else has an account, so the
 * household is deleted with the caller.
 */
export function LeaveHousehold({
  householdName,
  blocked,
  lastAdult,
}: {
  householdName: string;
  blocked: boolean;
  lastAdult: boolean;
}) {
  const router = useRouter();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<"network" | "server">("network");

  const copy = getLeaveDialogCopy({
    action: "leave",
    householdName,
    isLastAdultWithAccount: lastAdult,
  });

  const onConfirm = async (): Promise<boolean> => {
    let result: Awaited<ReturnType<typeof leaveHousehold>>;
    try {
      result = await leaveHousehold();
    } catch {
      setFailure("network");
      return false;
    }
    if (!result.ok) {
      setFailure(result.reason);
      return false;
    }
    // Replace, so «Indietro» does not lead back to a home that is gone.
    router.replace("/onboarding");
    return true;
  };

  return (
    <>
      <Button
        variant="pericolo"
        aria-haspopup="dialog"
        aria-describedby={blocked ? noteId : undefined}
        disabled={blocked}
        onClick={() => setOpen(true)}
      >
        {getLeaveButtonLabel(householdName)}
      </Button>
      {blocked ? (
        <div className="intestazione--centro">
          <p className="t-nota t-secondario" id={noteId}>
            {LEAVE_BLOCKED_NOTE}
          </p>
        </div>
      ) : (
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          title={copy.title}
          text={copy.text}
          errorText={copy.errorText[failure]}
          actions={[
            {
              label: copy.confirmLabel,
              variant: "pericolo-pieno",
              onClick: onConfirm,
            },
          ]}
        />
      )}
    </>
  );
}
