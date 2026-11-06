"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { finishRecovery } from "@/app/accesso/nuova-password/actions";
import { Button } from "@/components/ui/Button/Button";
import { PasswordField } from "@/components/ui/PasswordField/PasswordField";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { RECOVERY_EXPIRED_PATH } from "@/lib/auth/recovery-cookie";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout, Intro } from "./AuthLayout";
import { PASSWORD_TEXT, isRateLimit, validateNewPassword } from "./fields";
import { LimitNotice, NetworkNotice } from "./notices";
import styles from "./accesso.module.css";

const TEXT = {
  empty: "Scrivi la nuova password.",
  same: "È la password che usavi già: scegline una diversa.",
  network:
    "Non siamo riusciti a salvare la password. Controlla la connessione e riprova.",
  limit: "Troppi tentativi di fila. Aspetta qualche minuto e riprova.",
  saved: "Nuova password salvata.",
} as const;

type Step = "change" | "others" | "finish";
type Failure = "same" | "weak" | "gone" | "limit" | "network";

/**
 * `/accesso/nuova-password`. The password goes straight to Supabase (never
 * through our server), then the other sessions of the account are closed and
 * a server action deletes the recovery cookie and gives the destination.
 */
export function NewPasswordScreen({ email }: { email: string }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<"limit" | "network" | null>(null);

  const busy = useRef(false);
  // First step still to do: after a network failure «Riprova» goes on from
  // there, so a password already saved is not saved (and refused) twice.
  const next = useRef<Step>("change");
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      passwordRef.current?.focus();
    }
  }, []);

  async function runSteps(secret: string): Promise<Failure | null> {
    try {
      const supabase = createClient();
      if (next.current === "change") {
        const { error: updateError } = await supabase.auth.updateUser({
          password: secret,
        });
        if (updateError) {
          if (updateError.code === "same_password") return "same";
          if (updateError.code === "weak_password") return "weak";
          if (
            updateError.status === 401 ||
            updateError.status === 403 ||
            updateError.code === "session_not_found"
          ) {
            return "gone";
          }
          return isRateLimit(updateError) ? "limit" : "network";
        }
        next.current = "others";
      }
      if (next.current === "others") {
        // The other sessions of the account close, this one stays.
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "others",
        });
        if (signOutError) return "network";
        next.current = "finish";
      }
      return null;
    } catch {
      return "network";
    }
  }

  async function save(secret: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice(null);
    const failure = await runSteps(secret);

    if (failure === null) {
      try {
        const { destination } = await finishRecovery();
        showToast({ text: TEXT.saved, withoutNav: destination !== "/oggi" });
        router.replace(destination);
        return;
      } catch {
        // The cookie could not be deleted: «Riprova» tries only this step.
        busy.current = false;
        setPending(false);
        setNotice("network");
        return;
      }
    }

    busy.current = false;
    setPending(false);
    switch (failure) {
      case "same":
        setError(TEXT.same);
        passwordRef.current?.focus();
        break;
      case "weak":
        setError(PASSWORD_TEXT.weak);
        passwordRef.current?.focus();
        break;
      case "gone":
        router.replace(RECOVERY_EXPIRED_PATH);
        break;
      case "limit":
        setNotice("limit");
        break;
      default:
        setNotice("network");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setShown(false);
    const problem = validateNewPassword(password, TEXT.empty);
    setError(problem);
    if (problem) {
      passwordRef.current?.focus();
      return;
    }
    void save(password);
  }

  return (
    <AuthLayout
      back={null}
      intro={
        <Intro eyebrow="Password dimenticata" title="Scegli una nuova password">
          Per l&apos;account <b className={styles.address}>{email}</b>.
        </Intro>
      }
      form={{
        id: "accesso-nuova-password-modulo",
        action: "/accesso/nuova-password/invio",
        onSubmit: handleSubmit,
      }}
      body={
        <>
          {notice === "network" ? (
            <NetworkNotice
              text={TEXT.network}
              onRetry={() => void save(password)}
            />
          ) : notice === "limit" ? (
            <LimitNotice text={TEXT.limit} />
          ) : null}
          {/* So the password manager knows which account it updates. */}
          <input
            type="email"
            autoComplete="username"
            value={email}
            readOnly
            hidden
          />
          <PasswordField
            id="accesso-nuova-password"
            label="Nuova password"
            autoComplete="new-password"
            rules
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error ?? undefined}
            inputRef={passwordRef}
            readOnly={pending}
            shown={shown}
            onShownChange={setShown}
          />
        </>
      }
      actions={
        <Button variant="primary" type="submit" full loading={pending}>
          {pending ? "Salvataggio in corso" : "Salva la password"}
        </Button>
      }
    />
  );
}
