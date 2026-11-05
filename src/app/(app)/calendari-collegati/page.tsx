import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CalendarsError } from "@/components/calendari-collegati/CalendarsError";
import { CalendarsView } from "@/components/calendari-collegati/CalendarsView";
import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { PLACEHOLDERS } from "@/lib/app-routes";
import { LINK_RESULT_COOKIE, parseLinkResult } from "@/lib/calendar-sync/oauth";
import { requireNest } from "@/lib/nest-frame";
import { loadLinkedCalendars, type Loaded } from "./load";

export const metadata: Metadata = {
  // Neither the mail nor a calendar name are in the title: it ends up in the history.
  title: PLACEHOLDERS["calendari-collegati"].browserTitle,
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  const loaded: Loaded =
    frame.failed || !frame.me
      ? { ok: false }
      : await loadLinkedCalendars(frame.me.name).catch((): Loaded => ({
          ok: false,
        }));
  if (!loaded.ok) return <CalendarsError />;

  // The way back from the provider leaves one short cookie with the provider
  // and one word (no mail, no id): the page shows it once.
  const linkNotice = parseLinkResult(
    (await cookies()).get(LINK_RESULT_COOKIE)?.value,
  );

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <div className="colonna">
          <CalendarsView {...loaded.data} linkNotice={linkNotice} />
        </div>
      </div>
    </main>
  );
}
