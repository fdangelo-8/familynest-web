import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MemberError } from "@/components/membri/MemberError";
import {
  MemberView,
  type MemberViewProps,
} from "@/components/membri/MemberView";
import {
  inviteExpiryText,
  inviteSentText,
  inviteSubtitle,
} from "@/components/membri/texts";
import {
  CHOOSABLE_COLORS,
  type ChoosableColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { formatAge } from "@/lib/datetime";
import { requireNest, type NestFrameData } from "@/lib/nest-frame";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  // The name is not in the title: the title ends up in the history.
  title: "FamilyNest · Un membro del Nest",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isChoosable = (color: string): boolean =>
  (CHOOSABLE_COLORS as ReadonlyArray<string>).includes(color);

type Loaded =
  | { status: "error" }
  | { status: "missing" }
  | { status: "self" }
  | { status: "ok"; props: MemberViewProps };

/**
 * Reads the member, the viewer's own role and (administrators only, adults
 * without account) the pending invitation. The short code is never read.
 */
async function load(frame: NestFrameData, id: string): Promise<Loaded> {
  const supabase = await createClient();
  const { data: householdId, error: householdError } = await supabase.rpc(
    "current_household_id",
  );
  if (householdError || !householdId || !frame.me) return { status: "error" };
  const myColor = frame.me.color;

  const members = await supabase
    .from("household_members")
    .select("id, kind, name, color, birth_date, user_id, is_admin")
    .eq("household_id", householdId);
  if (members.error) return { status: "error" };

  // Not found, or of another Nest (RLS): the same answer.
  const member = members.data.find((m) => m.id === id);
  if (!member) return { status: "missing" };
  if (member.color === myColor) return { status: "self" };
  // The page of a child is decided by #31.
  if (member.kind === "child") return { status: "missing" };

  const canManage = members.data.some((m) => m.color === myColor && m.is_admin);
  const hasAccount = member.user_id !== null;

  let subtitle: string;
  let invite: MemberViewProps["invite"] = null;
  if (member.kind === "pet") {
    // The age text only. The birth date reaches the browser just for an
    // administrator (edit sheet, `birthDate` below), never for the others.
    subtitle = member.birth_date
      ? `Animale · ${formatAge(member.birth_date)}`
      : "Animale";
  } else if (!canManage || hasAccount) {
    subtitle = "Adulto";
  } else {
    // Only administrators can read invitations: the others never ask.
    const pending = await supabase
      .from("invitations")
      .select("token, created_at, expires_at")
      .eq("member_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending.error) return { status: "error" };
    if (!pending.data) {
      subtitle = "Adulto · da invitare";
    } else if (Date.parse(pending.data.expires_at) > Date.now()) {
      subtitle = inviteSubtitle(inviteSentText(pending.data.created_at));
      invite = {
        token: pending.data.token,
        expiresText: inviteExpiryText(pending.data.expires_at),
      };
    } else {
      subtitle = "Adulto · invito scaduto";
    }
  }

  // Only an administrator can change name and colour, and only of adults
  // without account and of pets. The birth date (pets) and the colours of the
  // others leave the server only for them.
  const canEdit = canManage && (member.kind === "pet" || !hasAccount);
  const taken: MemberViewProps["taken"] = canEdit
    ? members.data
        .filter((m) => m.id !== id && isChoosable(m.color))
        .map((m) => ({ color: m.color as ChoosableColor, by: m.name }))
    : [];

  return {
    status: "ok",
    props: {
      id: member.id,
      name: member.name,
      color: member.color,
      kind: member.kind === "pet" ? "pet" : "adult",
      subtitle,
      canManage,
      hasAccount,
      isAdmin: member.is_admin,
      invite,
      canEdit,
      birthDate: canEdit && member.kind === "pet" ? member.birth_date : null,
      taken,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  if (frame.failed) return <MemberError />;

  const loaded = await load(frame, id).catch((): Loaded => ({
    status: "error",
  }));
  if (loaded.status === "error") return <MemberError />;
  if (loaded.status === "missing") notFound();
  if (loaded.status === "self") redirect("/profilo");

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <div className="colonna">
          <MemberView {...loaded.props} />
        </div>
      </div>
    </main>
  );
}
