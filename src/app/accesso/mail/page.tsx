import { cookies } from "next/headers";
import { MailScreen } from "@/components/accesso/MailScreen";
import { redirectIfSignedIn } from "@/lib/auth/destination";
import { readInviteToken } from "@/lib/invitations";

export default async function AccessoMailPage() {
  // Someone who is already signed in never sees the sign-in pages.
  await redirectIfSignedIn();
  // The page only learns that the invitation cookie is there, never the token.
  const hasInvite = readInviteToken(await cookies()) !== null;
  return <MailScreen hasInvite={hasInvite} />;
}
