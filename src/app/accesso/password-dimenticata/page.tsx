import { ForgotScreen } from "@/components/accesso/ForgotScreen";
import { redirectIfSignedIn } from "@/lib/auth/destination";

export default async function PasswordDimenticataPage() {
  // Someone who is already signed in never sees the sign-in pages.
  await redirectIfSignedIn();
  return <ForgotScreen />;
}
