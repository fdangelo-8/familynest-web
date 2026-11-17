"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { AccountSentence, SignOutLink } from "./AccountLine";
import { AuthLayout, Intro } from "./AuthLayout";
import { ClearRecentSearches } from "./ClearRecentSearches";

/**
 * `/accesso/mail-confermata`: the address is confirmed and the person is in.
 * Says with which account, so on a shared device nobody goes on with the
 * wrong one. «Continua» goes where the sign-in would have gone.
 */
export function ConfirmedScreen({
  email,
  destination,
}: {
  email: string;
  destination: string;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <ClearRecentSearches />
      <AuthLayout
        back={null}
        intro={
          <Intro eyebrow="Accesso con la mail" title="Mail confermata">
            <AccountSentence email={email} />
          </Intro>
        }
        body={null}
        actions={
          <>
            <Button
              variant="primary"
              href={destination}
              full
              inactive={leaving}
              data-testid="mail-confermata-continua"
            >
              Continua
            </Button>
            <SignOutLink onPendingChange={setLeaving} />
          </>
        }
      />
    </>
  );
}

/** The session could not be read: never the content, only «Riprova». */
export function ConfirmedError() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    setRetrying(true);
    startTransition(() => {
      router.refresh();
      setRetrying(false);
    });
  };

  return (
    <AuthLayout
      back={null}
      intro={<Intro eyebrow="Accesso con la mail" title="Mail confermata" />}
      body={
        <Alert
          variant="errore"
          icon="wifi-off"
          action={
            <Button variant="link" loading={retrying} onClick={retry}>
              Riprova
            </Button>
          }
        >
          Non riusciamo a caricare la pagina. Controlla la connessione e
          riprova.
        </Alert>
      }
      actions={null}
    />
  );
}
