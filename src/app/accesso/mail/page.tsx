import { MailScreen } from "@/components/accesso/MailScreen";
import { redirectIfSignedIn } from "@/lib/auth/destination";

export default async function AccessoMailPage() {
  // Someone who is already signed in never sees the sign-in pages.
  await redirectIfSignedIn();
  return <MailScreen />;
}
