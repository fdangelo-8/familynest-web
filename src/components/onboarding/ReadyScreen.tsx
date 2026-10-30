"use client";

import { Brand } from "@/components/accesso/parts";
import { Avatar, type MemberColor } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import styles from "./onboarding.module.css";

export type ReadyMember = { name: string; color: MemberColor };

/** Most avatars in one row of the mobile layout (350 px). */
const PER_ROW = 5;

const TIP = "Prova a scrivere «spesa: latte e pane»";

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function AvatarRow({ members }: { members: ReadyMember[] }) {
  return (
    <span className="avatar-gruppo avatar-gruppo--grande avatar-gruppo--notte">
      {members.map((member, index) => (
        <Avatar
          key={index}
          name={member.name}
          color={member.color}
          size="xl"
          nameShown
        />
      ))}
    </span>
  );
}

/**
 * Everyone in the Nest. Desktop: one row. Mobile: rows of at most 5, so ten
 * avatars do not push the page sideways; the names are read once, on the
 * whole group.
 */
function Avatars({
  members,
  layout,
}: {
  members: ReadyMember[];
  layout: "mobile" | "desktop";
}) {
  const label = members.map((member) => member.name).join(", ");
  if (layout === "desktop") {
    return (
      <span
        className="avatar-gruppo avatar-gruppo--grande avatar-gruppo--notte"
        role="img"
        aria-label={label}
      >
        {members.map((member, index) => (
          <Avatar
            key={index}
            name={member.name}
            color={member.color}
            size="xl"
            nameShown
          />
        ))}
      </span>
    );
  }
  return (
    <div className="sezione" role="img" aria-label={label}>
      {chunk(members, PER_ROW).map((row, index) => (
        <AvatarRow key={index} members={row} />
      ))}
    </div>
  );
}

function Summary({ rows }: { rows: { icon: IconName; text: string }[] }) {
  return (
    <ul className="lista lista--notte">
      {rows.map((row) => (
        <li key={row.text} className="riga-lista riga-lista--notte">
          <Icon name={row.icon} />
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{row.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Body({
  nest,
  members,
  invites,
  layout,
}: {
  nest: string;
  members: ReadyMember[];
  invites: string | null;
  layout: "mobile" | "desktop";
}) {
  const rows: { icon: IconName; text: string }[] = [];
  if (invites) rows.push({ icon: "send", text: invites });
  rows.push({ icon: "sparkles", text: TIP });
  return (
    <div className="sezione">
      <Avatars members={members} layout={layout} />
      <h1 className="t-display claim">
        {nest}
        <br /> <b>è pronta.</b>
      </h1>
      <Summary rows={rows} />
    </div>
  );
}

/**
 * Last screen of the onboarding (mockup 06): night background, everyone's
 * avatars and a short summary of what happened. It reads and nothing else.
 * Two layouts in one <main>, only one visible: a single h1.
 */
export function ReadyScreen({
  nest,
  members,
  invites,
}: {
  nest: string;
  members: ReadyMember[];
  /** Already worded line about the invitations; null when there are none */
  invites: string | null;
}) {
  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <Body nest={nest} members={members} invites={invites} layout="mobile" />
        <div className="dialogo__azioni">
          <Button variant="chiaro" full href="/oggi">
            Vai a Oggi
          </Button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding__notte`}>
        <Brand />
        <Body
          nest={nest}
          members={members}
          invites={invites}
          layout="desktop"
        />
        <div>
          <Button variant="chiaro" href="/oggi">
            Vai a Oggi
          </Button>
        </div>
      </div>
    </main>
  );
}

function LoadingBody() {
  return (
    <SkeletonGroup label="Stiamo preparando la casa">
      <Skeleton shape="cerchio" night />
      <Skeleton shape="titolo" night />
      <Skeleton shape="testo" night />
    </SkeletonGroup>
  );
}

/**
 * Fallback while the page reads the Nest. It is a whole <main> that React
 * replaces with the real one, so the document never has two.
 */
export function ReadyLoading() {
  return (
    <main className={styles.root}>
      <div className={`${styles.mobile} schermo-notte tema-notte`}>
        <Brand />
        <LoadingBody />
        <div className="dialogo__azioni">
          <Button variant="chiaro" full loading>
            Preparazione in corso
          </Button>
        </div>
      </div>

      <div className={`${styles.desktop} split-onboarding__notte`}>
        <Brand />
        <LoadingBody />
        <div>
          <Button variant="chiaro" loading>
            Preparazione in corso
          </Button>
        </div>
      </div>
    </main>
  );
}
