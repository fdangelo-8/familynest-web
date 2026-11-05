import type { Metadata } from "next";
import { ProfileError } from "@/components/profilo/ProfileError";
import {
  ProfileView,
  type ProfileViewProps,
} from "@/components/profilo/ProfileView";
import { accessText, toDigestTime } from "@/components/profilo/model";
import { MEMBER_COLORS } from "@/components/ui/Avatar/Avatar";
import type { ChoosableColor } from "@/components/ui/ColorChoice/ColorChoice";
import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { PLACEHOLDERS } from "@/lib/app-routes";
import { requireNest, type NestFrameData } from "@/lib/nest-frame";
import {
  profileCalendarsInfo,
  readLinkedCalendars,
} from "@/lib/linked-calendars";
import { createClient } from "@/lib/supabase/server";
import { buildOutlook } from "./outlook";

export const metadata: Metadata = {
  // Neither the name nor the mail are in the title: it ends up in the history.
  title: PLACEHOLDERS["profilo"].browserTitle,
};

// Not imported from ColorChoice ("use client"): on the server that would be a
// client reference, not an array.
const isChoosable = (color: string): color is ChoosableColor =>
  color !== "insieme" &&
  (MEMBER_COLORS as ReadonlyArray<string>).includes(color);

type Loaded = { status: "error" } | { status: "ok"; props: ProfileViewProps };

/**
 * Reads the person (account, profile, member row) and what the dialog of the
 * deletion needs, always with the signed-in user's own session. Of the other
 * members only the colour leaves the server, plus the names of who stays in
 * the Nest for the text of the dialog; never mail, birth date or role.
 */
async function load(frame: NestFrameData): Promise<Loaded> {
  if (frame.failed || !frame.nestName) return { status: "error" };
  const supabase = await createClient();

  const [userResult, householdResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("current_household_id"),
  ]);
  const { data: userData, error: userError } = userResult;
  if (userError || !userData.user) return { status: "error" };
  const user = userData.user;

  const { data: householdId, error: householdError } = householdResult;
  if (householdError || !householdId) return { status: "error" };

  const [profile, members, outcome, linked] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, start_lens, morning_digest_time, default_event_visibility",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("id, name, color, kind, user_id, created_at")
      .eq("household_id", householdId),
    supabase.rpc("get_account_deletion_outcome"),
    readLinkedCalendars(supabase),
  ]);
  const outcomeRow = outcome.data?.[0];
  if (
    profile.error ||
    !profile.data ||
    members.error ||
    outcome.error ||
    !linked.ok ||
    !outcomeRow
  ) {
    return { status: "error" };
  }

  const me = members.data.find((m) => m.user_id === user.id);
  if (!me || !isChoosable(me.color)) return { status: "error" };

  const providers = (user.identities ?? []).map((i) => i.provider);
  const mail = user.email ?? null;
  const accountName = (profile.data.display_name ?? "").trim();
  const adultIn = `Adulto in ${frame.nestName}`;

  return {
    status: "ok",
    props: {
      heading: accountName || me.name,
      subtitle: mail ? `${mail} · ${adultIn}` : adultIn,
      memberName: me.name,
      color: me.color,
      taken: members.data
        .filter((m) => m.id !== me.id)
        .map((m) => m.color)
        .filter(isChoosable),
      preferences: {
        lens: profile.data.start_lens,
        digestTime: toDigestTime(profile.data.morning_digest_time),
        visibility: profile.data.default_event_visibility,
      },
      accessText: accessText(providers),
      calendars: {
        info: profileCalendarsInfo(linked.summary),
        count:
          linked.summary.providers.length > 0
            ? linked.summary.enabledCount
            : null,
      },
      householdName: frame.nestName,
      outlook: buildOutlook(members.data, user.id, {
        deletes_household: outcomeRow.deletes_household,
        // The generated type says `string`, the database can send null.
        next_admin_member_id: outcomeRow.next_admin_member_id as string | null,
      }),
    },
  };
}

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();

  const loaded = await load(frame).catch((): Loaded => ({ status: "error" }));
  if (loaded.status === "error") return <ProfileError />;

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <div className="colonna">
          <ProfileView {...loaded.props} />
        </div>
      </div>
    </main>
  );
}
