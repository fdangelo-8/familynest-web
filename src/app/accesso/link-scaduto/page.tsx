import { ExpiredScreen } from "@/components/accesso/ExpiredScreen";
import { redirectIfSignedIn } from "@/lib/auth/destination";

export default async function LinkScadutoPage() {
  // Someone who is already signed in never sees the sign-in pages.
  await redirectIfSignedIn();
  return <ExpiredScreen />;
}
