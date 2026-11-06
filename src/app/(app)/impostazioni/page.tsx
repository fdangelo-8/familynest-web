import type { Metadata } from "next";
import { LeaveHousehold } from "@/components/impostazioni/LeaveHousehold";
import {
  NotificationSettings,
  type NotificationValues,
} from "@/components/impostazioni/NotificationSettings";
import { SettingsError } from "@/components/impostazioni/SettingsError";
import { ResetOnReveal } from "@/components/ui/AppFrame/ResetOnReveal";
import { SettingsMenu } from "@/components/ui/AppFrame/SettingsMenu";
import { Avatar, type MemberColor } from "@/components/ui/Avatar/Avatar";
import { ListRow } from "@/components/ui/List/List";
import { Tag } from "@/components/ui/Tag/Tag";
import { PLACEHOLDERS } from "@/lib/app-routes";
import { formatAge } from "@/lib/datetime";
import { requireNest, type NestFrameData } from "@/lib/nest-frame";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: PLACEHOLDERS["impostazioni"].browserTitle,
};

type Row = {
  id: string;
  name: string;
  color: MemberColor;
  isMe: boolean;
  /** Where the row leads: «/profilo», «/membri/<id>» or «/figli/<id>» */
  href: string | null;
  info: string | null;
  tag: string;
};

type Loaded = {
  nestName: string;
  rows: Row[];
  notifications: NotificationValues;
  /** The caller is the only administrator and another adult has an account */
  blocked: boolean;
  /** No other adult has an account: the Nest goes away with the caller */
  lastAdult: boolean;
};

/**
 * Reads Nest, members, (administrators only) invitations and the caller's own
 * notification choices. `null` on any error. Only texts leave the server:
 * never a birth date, an account id, a token or a code.
 */
async function load(frame: NestFrameData): Promise<Loaded | null> {
  const supabase = await createClient();
  const { data: householdId, error: householdError } = await supabase.rpc(
    "current_household_id",
  );
  if (householdError || !householdId || !frame.me || frame.nestName === null) {
    return null;
  }
  const myColor = frame.me.color;

  const [members, preferences] = await Promise.all([
    supabase
      .from("household_members")
      .select("id, kind, name, color, birth_date, user_id, is_admin")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase.rpc("get_notification_preferences"),
  ]);
  if (members.error || preferences.error) return null;
  const mine = preferences.data[0];
  if (!mine) return null;

  const me = members.data.find((m) => m.color === myColor);
  if (!me) return null;
  const admin = me.is_admin;

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
    const isMe = m.id === me.id;
    if (m.kind === "adult") {
      let info: string | null = null;
      if (!isMe && admin && !m.user_id) {
        if (!pending.has(m.id)) info = "Da invitare";
        else info = pending.get(m.id) ? "Invito in attesa" : "Invito scaduto";
      }
      return {
        id: m.id,
        name: m.name,
        color: m.color,
        isMe,
        href: isMe ? "/profilo" : `/membri/${m.id}`,
        info,
        tag: m.is_admin ? "Amministratore" : "Adulto",
      };
    }
    return {
      id: m.id,
      name: m.name,
      color: m.color,
      isMe: false,
      // Same destination as in «Il tuo Nest»: children have their page (#31).
      href: m.kind === "child" ? `/figli/${m.id}` : `/membri/${m.id}`,
      // The age text only, never the birth date.
      info: m.birth_date ? formatAge(m.birth_date) : null,
      tag: m.kind === "child" ? "Figlio o figlia" : "Animale",
    };
  });

  const othersWithAccount = members.data.some(
    (m) => m.kind === "adult" && m.user_id !== null && m.id !== me.id,
  );
  const otherAdmin = members.data.some((m) => m.is_admin && m.id !== me.id);

  return {
    nestName: frame.nestName,
    rows,
    notifications: {
      events: mine.events,
      assigned_todos: mine.assigned_todos,
      shopping: mine.shopping,
      free_together: mine.free_together,
      morning_digest: mine.morning_digest,
    },
    blocked: admin && !otherAdmin && othersWithAccount,
    lastAdult: !othersWithAccount,
  };
}

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  const loaded = frame.failed ? null : await load(frame).catch(() => null);
  if (!loaded) return <SettingsError />;

  const { nestName, rows, notifications, blocked, lastAdult } = loaded;

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonne colonne--menu">
        <SettingsMenu />
        <div className="colonna">
          <h1 className="t-titolo-pagina">{nestName}</h1>

          <section className="sezione" aria-labelledby="chi-c-e-titolo">
            <div className="sezione__testa">
              <h2 className="sezione__titolo" id="chi-c-e-titolo">
                Chi c’è
              </h2>
            </div>
            <ul className="scheda lista">
              {rows.map((row) => {
                const content = (
                  <>
                    <Avatar
                      name={row.name}
                      color={row.color}
                      size="m"
                      nameShown
                    />
                    <span className="riga-lista__testo">
                      <span className="riga-lista__titolo">
                        {row.isMe ? `${row.name}, tu` : row.name}
                      </span>
                      {row.info ? (
                        <span className="riga-lista__info">{row.info}</span>
                      ) : null}
                    </span>
                    <Tag>{row.tag}</Tag>
                  </>
                );
                return row.href ? (
                  <ListRow key={row.id} href={row.href}>
                    {content}
                  </ListRow>
                ) : (
                  <li key={row.id}>
                    <div className="riga-lista">{content}</div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            id="notifiche"
            className="sezione sezione--ancora"
            aria-labelledby="notifiche-titolo"
          >
            <div className="sezione__testa">
              <h2 className="sezione__titolo" id="notifiche-titolo">
                Notifiche
              </h2>
            </div>
            <NotificationSettings initial={notifications} />
          </section>

          <ResetOnReveal>
            <LeaveHousehold
              householdName={nestName}
              blocked={blocked}
              lastAdult={lastAdult}
            />
          </ResetOnReveal>
        </div>
      </div>
    </main>
  );
}
