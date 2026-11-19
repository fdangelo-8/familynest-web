import { redirect } from "next/navigation";

// The mail and password form lives in /accesso since #461: the old address
// only sends there (a signed-in person is then sent on by that page).
export default function AccessoMailPage() {
  redirect("/accesso");
}
