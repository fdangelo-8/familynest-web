import type { Metadata } from "next";
import Link from "next/link";
import { EnterFromBottom } from "@/components/nest/EnterFromBottom";
import { InviteSomeone } from "@/components/nest/InviteSomeone";
import { NestError } from "@/components/nest/NestError";
import { Avatar, type MemberColor } from "@/components/ui/Avatar/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { ListRow } from "@/components/ui/List/List";
import { PLACEHOLDERS } from "@/lib/app-routes";
import { formatAge } from "@/lib/datetime";
import { MAX_HOUSEHOLD_MEMBERS } from "@/lib/household-limits";
import { requireNest } from "@/lib/nest-frame";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: PLACEHOLDERS["nest"].browserTitle,
};

type Row = {
  id: string;
  name: string;
  color: MemberColor;
  isMe: boolean;
  info: string;
};

type Loaded = {
  nestName: string;
  rows: Row[];
  admin: boolean;
};

const SETTINGS: ReadonlyArray<{
  icon: IconName;
  title: string;
  info?: string;
  href: string;
}> = [
  {
    icon: "calendar-arrow-down",
    title: "Calendari collegati",
    href: "/calendari-collegati",
  },
  { icon: "bell", title: "Notifiche", href: "/notifiche" },
  {
    icon: "settings",
    title: "Impostazioni della casa",
    info: "Piano, membri, aspetto",
    href: "/impostazioni",
  },
];

/** Reads Nest, members and (administrators only) invitations. `null` on any error. */
async function load(): Promise<Loaded | null> {
  const supabase = await createClient();
  // Two independent reads at once: fewer round trips before the page shows.
  const [{ data: userData, error: userError }, householdResult] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("current_household_id"),
    ]);
  if (userError || !userData.user) return null;
  const userId = userData.user.id;

  const { data: householdId, error: householdError } = householdResult;
  if (householdError || !householdId) return null;

  const [household, members] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("id, kind, name, color, birth_date, user_id, is_admin")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (household.error || !household.data || members.error) return null;

  const admin = members.data.some((m) => m.user_id === userId && m.is_admin);

  // Only administrators can read invitations: the others never ask.
  // Only member, status and expiry are read, never the token or the code.
  const pending = new Map<string, boolean>();
  if (admin) {
    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("member_id, status, expires_at")
      .eq("household_id", householdId)
      .eq("status", "pending");
    if (error) return null;
    const now = Date.now();
    for (const invitation of invitations) {
      const valid = new Date(invitation.expires_at).getTime() > now;
      pending.set(
        invitation.member_id,
        valid || (pending.get(invitation.member_id) ?? false),
      );
    }
  }

  const rows = members.data.map((m): Row => {
    const isMe = m.user_id === userId;
    let info: string;
    if (m.kind === "adult") {
      if (isMe) info = "Adulto · il tuo profilo";
      else if (!admin || m.user_id) info = "Adulto";
      else if (!pending.has(m.id)) info = "Adulto · da invitare";
      else
        info = pending.get(m.id)
          ? "Adulto · invito in attesa"
          : "Adulto · invito scaduto";
    } else {
      const label = m.kind === "child" ? "Figlio o figlia" : "Animale";
      // Only the age text leaves the server, never the birth date.
      info = m.birth_date ? `${label}, ${formatAge(m.birth_date)}` : label;
    }
    return {
      id: m.id,
      name: m.name,
      color: m.color,
      isMe,
      info,
    };
  });

  return { nestName: household.data.name, rows, admin };
}

function MemberRow({ row }: { row: Row }) {
  const content = (
    <>
      <Avatar name={row.name} color={row.color} size="l" nameShown />
      <span className="riga-lista__testo">
        <span className="riga-lista__titolo">
          {row.isMe ? `${row.name}, tu` : row.name}
        </span>
        <span className="riga-lista__info">{row.info}</span>
      </span>
      {row.isMe ? (
        <span className="riga-lista__valore">
          <Icon name="chevron-right" />
        </span>
      ) : null}
    </>
  );
  // Rows of the others become links when their pages exist (#18, #31).
  return row.isMe ? (
    <ListRow href="/profilo">{content}</ListRow>
  ) : (
    <li>
      <div className="riga-lista">{content}</div>
    </li>
  );
}

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  const loaded = frame.failed ? null : await load().catch(() => null);
  if (!loaded) return <NestError />;

  const { nestName, rows, admin } = loaded;
  const full = rows.length >= MAX_HOUSEHOLD_MEMBERS;

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <EnterFromBottom />
      <div className="colonne colonne--due">
        <div className="colonna">
          <h1 className="t-titolo-pagina">{nestName}</h1>
          <section className="sezione">
            <div className="sezione__testa">
              <h2 className="sezione__titolo">Chi c’è</h2>
              <span className="sezione__info">{rows.length}</span>
            </div>
            <ul className="scheda lista" aria-label="Chi c’è">
              {rows.map((row) => (
                <MemberRow key={row.id} row={row} />
              ))}
            </ul>
          </section>
        </div>
        <div className="colonna">
          <Link className="porta" href="/esplora">
            <span>
              <span className="porta__sopra">Esplora</span>
              <span className="porta__titolo">
                Cosa può fare
                <br /> la vostra casa
              </span>
            </span>
            <span className="porta__freccia">
              <Icon name="arrow-right" />
            </span>
          </Link>
          <ul className="scheda lista">
            {SETTINGS.map((item) => (
              <ListRow key={item.href} href={item.href}>
                <span className="icona-riquadro">
                  <Icon name={item.icon} />
                </span>
                <span className="riga-lista__testo">
                  <span className="riga-lista__titolo">{item.title}</span>
                  {item.info ? (
                    <span className="riga-lista__info">{item.info}</span>
                  ) : null}
                </span>
                <span className="riga-lista__valore">
                  <Icon name="chevron-right" />
                </span>
              </ListRow>
            ))}
          </ul>
          {admin ? (
            <InviteSomeone
              full={full}
              taken={rows.map((row) => ({
                color: row.color as Exclude<MemberColor, "insieme">,
                by: row.name,
              }))}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
