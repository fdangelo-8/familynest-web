import { redirect } from "next/navigation";
import { NewPasswordScreen } from "@/components/accesso/NewPasswordScreen";
import { requireRecoverySession } from "@/lib/auth/recovery";
import { RECOVERY_EXPIRED_PATH } from "@/lib/auth/recovery-cookie";
import { createClient } from "@/lib/supabase/server";

export default async function NuovaPasswordPage() {
  // Session AND recovery cookie, otherwise «link scaduto». A person who is
  // already signed in is not sent away: this page is for them.
  await requireRecoverySession();

  // The address of the account is shown ("Per l'account ...") so that nobody
  // changes the password of an account that is not theirs without noticing.
  let email: string | undefined;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error) email = data.user?.email;
  } catch {
    email = undefined;
  }
  // redirect() throws: it stays outside the try block.
  if (!email) redirect(RECOVERY_EXPIRED_PATH);
  return <NewPasswordScreen email={email} />;
}
