"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dayAndMonthName } from "@/components/lista-desideri/model";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { PageError } from "@/components/ui/PageError/PageError";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { toDayKey } from "@/lib/datetime";
import {
  getGiverKey,
  getSavedGiverName,
  loadPublicWishlist,
  loadPublicWishlistPhoto,
  reservePublicWishlistItem,
  saveGiverName,
  type PublicWishlist,
  type PublicWishlistItem,
} from "@/lib/public-wishlist";
import { formatWishlistPrice, wishlistInfoLine } from "@/lib/wishlist-texts";
import { GiveSheet, type GiveResult } from "./GiveSheet";
import { PublicSkeleton } from "./PublicSkeleton";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "inactive" }
  | { status: "active"; wishlist: PublicWishlist };

type Variant = "m" | "d";

const OFFLINE_TEXT = "Sei offline. Per segnare un regalo serve la connessione.";

/**
 * The public page of a wish list (#33). The server sends only the frame: the
 * list is read here, in the browser, with the code in the body of a `POST`,
 * so the HTML, the previews of the messages and every cache see nothing of
 * the family. Whoever opens it is treated the same, with or without a session.
 */
export function PublicWishlistPage({ code }: { code: string }) {
  const { showToast } = useToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [giving, setGiving] = useState<PublicWishlistItem | null>(null);
  const alive = useRef(true);
  const sequence = useRef(0);
  const loaded = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  /** The idea the focus goes to when the sheet has left and left nothing */
  const focusMine = useRef<string | null>(null);
  const photoRequests = useRef(new Set<string>());

  const load = useCallback(async (): Promise<boolean> => {
    const mine = ++sequence.current;
    const result = await loadPublicWishlist(code, getGiverKey());
    if (!alive.current || mine !== sequence.current) return result.ok;
    if (!result.ok) {
      // Keep what is on screen and say that it may be old.
      if (loaded.current) setOffline(true);
      else setState({ status: "error" });
      return false;
    }
    loaded.current = true;
    setOffline(false);
    if (result.status === "inactive") {
      setState({ status: "inactive" });
      return true;
    }
    setState({ status: "active", wishlist: result.wishlist });
    // The photos are read once each, with the code in the body of a POST.
    for (const item of result.wishlist.items) {
      if (!item.hasPhoto || photoRequests.current.has(item.id)) continue;
      photoRequests.current.add(item.id);
      void loadPublicWishlistPhoto(code, item.id).then((src) => {
        if (src && alive.current) {
          setPhotos((current) => ({ ...current, [item.id]: src }));
        }
      });
    }
    return true;
  }, [code]);

  useEffect(() => {
    alive.current = true;
    // Reads once when the page opens.
    const first = () => void load();
    first();
    const goOffline = () => {
      if (loaded.current) setOffline(true);
    };
    const comeBack = () => {
      if (loaded.current) void load();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", comeBack);
    return () => {
      alive.current = false;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", comeBack);
    };
  }, [load]);

  // The sheet has left. The sheet gives the focus back to the button that
  // opened it; if that is gone (the idea is now «Lo regali tu») the focus goes
  // to the label that took its place.
  useEffect(() => {
    const isOpen = giving !== null;
    if (wasOpen.current && !isOpen) {
      if (
        document.activeElement === null ||
        document.activeElement === document.body
      ) {
        const target = focusMine.current
          ? Array.from(
              mainRef.current?.querySelectorAll<HTMLElement>(
                `[data-mine-id="${focusMine.current}"]`,
              ) ?? [],
            ).find((element) => element.getClientRects().length > 0)
          : undefined;
        target?.focus();
      }
      focusMine.current = null;
    }
    wasOpen.current = isOpen;
  }, [giving]);

  const retry = async () => {
    setRetrying(true);
    await load();
    if (alive.current) setRetrying(false);
  };

  const give = async (
    item: PublicWishlistItem,
    childName: string,
    name: string,
  ): Promise<GiveResult> => {
    const key = getGiverKey();
    if (key === null) {
      return {
        kind: "alert",
        text: "Non siamo riusciti a segnarlo per un problema nostro. Riprova tra qualche minuto.",
      };
    }
    const result = await reservePublicWishlistItem(code, item.id, name, key);
    if (!result.ok) {
      return {
        kind: "alert",
        text:
          result.reason === "network"
            ? "Non siamo riusciti a segnarlo. Controlla la connessione e riprova."
            : "Non siamo riusciti a segnarlo per un problema nostro. Riprova tra qualche minuto.",
      };
    }
    switch (result.outcome) {
      case "reserved":
        saveGiverName(name);
        focusMine.current = item.id;
        await load();
        showToast({
          lead: "Segnato a tuo nome.",
          text: `I genitori lo sapranno, ${childName} no.`,
          icon: "gift",
          withoutNav: true,
        });
        return { kind: "done" };
      case "taken":
        await load();
        return {
          kind: "alert",
          text: "Qualcun altro l'ha appena preso. Scegli un'altra idea.",
        };
      case "not_found":
        await load();
        return { kind: "alert", text: "Questa idea non c'è più." };
      case "inactive":
        setGiving(null);
        setState({ status: "inactive" });
        return { kind: "done" };
      case "rate_limited":
        return {
          kind: "alert",
          text: "Hai segnato molti regali in poco tempo. Riprova tra qualche minuto.",
        };
      case "invalid_name":
        return {
          kind: "name",
          text: "Scrivi il tuo nome, così i genitori sanno chi lo regala.",
        };
      default:
        return {
          kind: "alert",
          text: "Non siamo riusciti a segnarlo per un problema nostro. Riprova tra qualche minuto.",
        };
    }
  };

  return (
    <div className="cornice-pubblica">
      <main
        ref={mainRef}
        id="contenuto"
        tabIndex={-1}
        className={
          state.status === "inactive"
            ? "pagina pagina-desktop pagina-desktop--centrata"
            : "pagina pagina-desktop"
        }
      >
        {state.status === "loading" ? <PublicSkeleton /> : null}

        {state.status === "error" ? (
          <PageError
            headingLevel={1}
            text="Controlla la connessione e riprova."
            retrying={retrying}
            onRetry={() => void retry()}
          />
        ) : null}

        {state.status === "inactive" ? (
          <PageError
            headingLevel={1}
            title="Questa lista non è più attiva"
            text="La festa è passata o chi l'ha creata ha chiuso il link. Chiedi ai genitori un link nuovo."
            action={{ label: "Chiudi", href: "/", icon: "x" }}
          />
        ) : null}

        {state.status === "active" ? (
          <>
            <Content
              wishlist={state.wishlist}
              photos={photos}
              offline={offline}
              retrying={retrying}
              onRetry={() => void retry()}
              onGive={setGiving}
            />
            {giving ? (
              <GiveSheet
                itemTitle={giving.title}
                childName={state.wishlist.childName}
                initialName={getSavedGiverName()}
                onClose={() => setGiving(null)}
                onGive={(name) => give(giving, state.wishlist.childName, name)}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

function Content({
  wishlist,
  photos,
  offline,
  retrying,
  onRetry,
  onGive,
}: {
  wishlist: PublicWishlist;
  photos: Record<string, string>;
  offline: boolean;
  retrying: boolean;
  onRetry: () => void;
  onGive: (item: PublicWishlistItem) => void;
}) {
  const { childName, childColor, items } = wishlist;
  const today = toDayKey(new Date());
  const isToday =
    Number(today.slice(5, 7)) === wishlist.occasionMonth &&
    Number(today.slice(8, 10)) === wishlist.occasionDay;
  const day = isToday
    ? "Oggi"
    : `Il ${dayAndMonthName(wishlist.occasionDay, wishlist.occasionMonth)}`;
  const empty = items.length === 0;

  const head = (variant: Variant) => (
    <>
      <Avatar name={childName} color={childColor} size="xl" nameShown />
      <h1 className="t-titolo-pagina" tabIndex={-1}>
        Il compleanno di {childName}
      </h1>
      <p className="t-corpo t-secondario">
        {day}. Qui ci sono le idee regalo: scegline una e segna «Lo regalo io»,
        così nessuno la ripete.
      </p>
      {offline ? (
        <Alert
          variant="errore"
          icon="wifi-off"
          action={
            <Button variant="link" loading={retrying} onClick={onRetry}>
              Riprova
            </Button>
          }
          data-testid={`pubblica-offline-${variant}`}
        >
          {OFFLINE_TEXT}
        </Alert>
      ) : null}
    </>
  );

  const emptyState = (
    <EmptyState
      icon="gift"
      title="Ancora nessuna idea"
      text={`I genitori non hanno ancora scritto le idee per ${childName}. Riapri questo link tra qualche giorno.`}
      actions={null}
    />
  );

  const brand = (
    <p className="marchio t-nota t-secondario">
      <span className="quadrato-nest" aria-hidden="true">
        <span className="quadrato-nest__punto membro-pomodoro" />
        <span className="quadrato-nest__punto membro-glicine" />
        <span className="quadrato-nest__punto membro-salvia" />
        <span className="quadrato-nest__punto membro-cobalto" />
      </span>
      Lista creata con FamilyNest
    </p>
  );

  return (
    <>
      {/* Mobile: head, rows, brand. The other layout is `display: none`. */}
      <div className="sezione pubblica-solo-mobile">{head("m")}</div>
      {empty ? (
        <div className="pubblica-solo-mobile">{emptyState}</div>
      ) : (
        <ul className="scheda lista pubblica-solo-mobile">
          {items.map((item) => (
            <GiftRow
              key={item.id}
              item={item}
              photo={photos[item.id]}
              onGive={onGive}
            />
          ))}
        </ul>
      )}
      <div className="pubblica-solo-mobile">{brand}</div>

      {/* Desktop: head and brand on the left, cards on the right. */}
      <div className="colonne colonne--menu pubblica-solo-desktop">
        <div className="colonna">
          <div className="sezione">
            {head("d")}
            {brand}
          </div>
        </div>
        <div className="colonna">
          {empty ? (
            emptyState
          ) : (
            <ul className="colonne colonne--tre">
              {items.map((item) => (
                <GiftCard
                  key={item.id}
                  item={item}
                  photo={photos[item.id]}
                  onGive={onGive}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function Photo({ src }: { src: string | undefined }) {
  return (
    <span className="foto" aria-hidden="true">
      {src ? (
        // The copy of the photo is a `data:` address: no request is made.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="foto__immagine" src={src} alt="" />
      ) : (
        <Icon name="gift" size="l" />
      )}
    </span>
  );
}

/** The title: a link to the shop when the idea has one, else plain text. */
function Title({ item, id }: { item: PublicWishlistItem; id: string }) {
  if (item.url) {
    return (
      <a
        id={id}
        className="riga-regalo__titolo"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {item.title}
        <VisuallyHidden>
          , sito del negozio, si apre in una nuova scheda
        </VisuallyHidden>
      </a>
    );
  }
  return (
    <span id={id} className="riga-regalo__titolo">
      {item.title}
    </span>
  );
}

/** «Lo regalo io», «Lo regali tu» or «Già preso». Never who took it. */
function Action({
  item,
  titleId,
  onGive,
}: {
  item: PublicWishlistItem;
  titleId: string;
  onGive: (item: PublicWishlistItem) => void;
}) {
  if (item.state === "mine") {
    return (
      <span
        className="etichetta etichetta--scura"
        tabIndex={-1}
        data-mine-id={item.id}
      >
        <Icon name="check" size="s" />
        Lo regali tu
      </span>
    );
  }
  if (item.state === "taken") {
    return (
      <span className="etichetta">
        <Icon name="check" size="s" />
        Già preso
      </span>
    );
  }
  return (
    <Button
      small
      aria-describedby={titleId}
      aria-haspopup="dialog"
      onClick={() => onGive(item)}
    >
      Lo regalo io
    </Button>
  );
}

function GiftRow({
  item,
  photo,
  onGive,
}: {
  item: PublicWishlistItem;
  photo: string | undefined;
  onGive: (item: PublicWishlistItem) => void;
}) {
  const titleId = `m-${item.id}`;
  const price = formatWishlistPrice(item.priceCents);
  return (
    <li
      className={
        item.state === "taken"
          ? "riga-regalo riga-regalo--barrato"
          : "riga-regalo"
      }
    >
      <Photo src={photo} />
      <span className="riga-lista__testo">
        <Title item={item} id={titleId} />
        {price ? <span className="riga-lista__info">{price}</span> : null}
      </span>
      <Action item={item} titleId={titleId} onGive={onGive} />
    </li>
  );
}

function GiftCard({
  item,
  photo,
  onGive,
}: {
  item: PublicWishlistItem;
  photo: string | undefined;
  onGive: (item: PublicWishlistItem) => void;
}) {
  const titleId = `d-${item.id}`;
  const taken = item.state === "taken";
  const price = formatWishlistPrice(item.priceCents);
  const info = wishlistInfoLine(item.shopName, item.note);
  return (
    <li
      className={
        taken
          ? "scheda scheda-regalo scheda-regalo--preso"
          : "scheda scheda-regalo"
      }
    >
      <Photo src={photo} />
      <div className="scheda-regalo__info">
        <Title item={item} id={titleId} />
        {taken ? (
          <span className="riga-lista__info" aria-hidden="true">
            {" "}
          </span>
        ) : (
          <span className="riga-lista__info">{info}</span>
        )}
        <div className="scheda-regalo__piede">
          <span className="riga-regalo__prezzo">{price}</span>
          <Action item={item} titleId={titleId} onGive={onGive} />
        </div>
      </div>
    </li>
  );
}
