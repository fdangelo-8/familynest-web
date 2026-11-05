"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { BarAction } from "@/components/ui/AppFrame/BarAction";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { PageError } from "@/components/ui/PageError/PageError";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { formatTime } from "@/lib/datetime";
import { formatWishlistPrice } from "@/lib/wishlist-texts";
import { AddIdeaSheet } from "./AddIdeaSheet";
import { CopyLinkSheet } from "./CopyLinkSheet";
import { EditIdeaSheet } from "./EditIdeaSheet";
import { ShareBlock } from "./ShareBlock";
import { disableWishlistLink, shareWishlist } from "./api";
import {
  freeItems,
  occasionView,
  shareView,
  takenItems,
  wishlistInfoLine,
  type WishItem,
  type WishlistData,
} from "./model";
import { useWishlist } from "./useWishlist";
import { WishlistSkeleton } from "./WishlistSkeleton";

type Sheet =
  | { type: "add" }
  | { type: "edit"; item: WishItem }
  | { type: "copy"; url: string };

/** Puts the address in the clipboard; false if the browser does not allow it. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lista desideri di un figlio (#32). The server has only checked that the
 * address is a child of the Nest; the list is read here, in the browser, so
 * the page has its own loading and error states and the HTML carries nothing
 * of the child or of the ideas.
 */
export function WishlistPage({ childId }: { childId: string }) {
  const wishlist = useWishlist(childId);
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);
  const disableRef = useRef<HTMLButtonElement>(null);
  const retriedPage = useRef(false);
  const wasOpen = useRef(false);
  /** Where the focus goes when the sheet that had it has left and left nothing */
  const afterClose = useRef<string | null>(null);

  const { status, data } = wishlist;
  const ready = status === "ready" && data !== null;

  const focusHeading = useCallback(() => {
    mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, []);

  // After a «Riprova» of the page error that worked, the focus goes to the name.
  useEffect(() => {
    if (ready && retriedPage.current) {
      retriedPage.current = false;
      focusHeading();
    }
  }, [ready, focusHeading]);

  // The sheet has left. The sheet gives the focus back to what opened it; if
  // that is gone (the button of the empty state, an idea that was deleted) the
  // focus goes to the next idea, or to the name.
  useEffect(() => {
    const isOpen = sheet !== null;
    if (wasOpen.current && !isOpen) {
      if (
        document.activeElement === null ||
        document.activeElement === document.body
      ) {
        const target = afterClose.current
          ? mainRef.current?.querySelector<HTMLElement>(
              `[data-idea-id="${afterClose.current}"]`,
            )
          : null;
        if (target) target.focus();
        else focusHeading();
      }
      afterClose.current = null;
    }
    wasOpen.current = isOpen;
  }, [sheet, focusHeading]);

  const handleShare = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    const result = await shareWishlist(childId);
    if (!result.ok) {
      showToast({
        text: "Non siamo riusciti a creare il link. Controlla la connessione e riprova.",
        icon: null,
      });
    } else {
      const url = `${window.location.origin}/desideri/${result.code}`;
      const copied = await copyToClipboard(url);
      if (copied) {
        showToast({ text: "Link copiato. Mandalo a nonni e parenti." });
      } else {
        setSheet({ type: "copy", url });
      }
      await wishlist.reload();
    }
    sharingRef.current = false;
    setSharing(false);
  };

  const handleDisable = async (): Promise<boolean> => {
    const result = await disableWishlistLink(childId);
    if (!result.ok) return false;
    await wishlist.reload();
    showToast({
      text: "Link disattivato. Chi lo apre vede che la lista non è più attiva.",
    });
    return true;
  };

  const handleOfflineRetry = async () => {
    const hadFocus = alertRef.current?.contains(document.activeElement);
    const ok = await wishlist.retry();
    if (ok && hadFocus) focusHeading();
  };

  const handleDeleted = async (item: WishItem) => {
    if (data) {
      // The next idea of the same list takes the focus, else the previous one.
      const list = [...freeItems(data.items), ...takenItems(data.items)].filter(
        (other) =>
          item.takenAt === null
            ? other.takenAt === null
            : other.takenAt !== null,
      );
      const at = list.findIndex((other) => other.id === item.id);
      afterClose.current = (list[at + 1] ?? list[at - 1])?.id ?? null;
    }
    await wishlist.reload();
    showToast({ text: "Idea eliminata." });
  };

  return (
    <main
      ref={mainRef}
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      {status === "loading" || ready ? (
        <BarAction
          icon="plus"
          label="Aggiungi un'idea"
          aria-haspopup="dialog"
          inactive={!ready}
          onClick={() => setSheet({ type: "add" })}
        />
      ) : null}

      {status === "loading" ? <WishlistSkeleton /> : null}

      {status === "error" ? (
        <PageError
          headingLevel={1}
          retrying={wishlist.retrying}
          onRetry={() => {
            retriedPage.current = true;
            void wishlist.retry();
          }}
          exit={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      ) : null}

      {status === "missing" ? (
        <PageError
          headingLevel={1}
          title="Questa pagina non c’è"
          text="Il link potrebbe essere vecchio o scritto male."
          action={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      ) : null}

      {ready ? (
        <>
          <WishlistContent
            data={data}
            offline={wishlist.offline}
            retrying={wishlist.retrying}
            alertRef={alertRef}
            shareRef={shareRef}
            disableRef={disableRef}
            sharing={sharing}
            onRetry={() => void handleOfflineRetry()}
            onAdd={() => setSheet({ type: "add" })}
            onEdit={(item) => setSheet({ type: "edit", item })}
            onShare={() => void handleShare()}
            onDisable={() => setDisabling(true)}
          />
          {sheet?.type === "add" ? (
            <AddIdeaSheet
              childId={childId}
              onClose={() => setSheet(null)}
              onAdded={wishlist.reload}
            />
          ) : null}
          {sheet?.type === "edit" ? (
            <EditIdeaSheet
              item={sheet.item}
              onClose={() => setSheet(null)}
              onSaved={async (changed) => {
                if (!changed) return;
                await wishlist.reload();
                showToast({ text: "Modifiche salvate" });
              }}
              onDeleted={handleDeleted}
            />
          ) : null}
          {sheet?.type === "copy" ? (
            <CopyLinkSheet url={sheet.url} onClose={() => setSheet(null)} />
          ) : null}
          <ConfirmDialog
            open={disabling}
            onClose={() => {
              setDisabling(false);
              // «Disattiva il link» is gone: the focus goes to «Condividi».
              requestAnimationFrame(() => {
                if (
                  document.activeElement === null ||
                  document.activeElement === document.body
                ) {
                  shareRef.current?.focus();
                }
              });
            }}
            title="Disattivare il link?"
            text="Chi ha il link non vedrà più la lista. I regali già presi restano segnati."
            errorText="Non siamo riusciti a disattivare il link. Controlla la connessione e riprova."
            actions={[
              {
                label: "Disattiva",
                variant: "pericolo-pieno",
                onClick: handleDisable,
              },
            ]}
          />
        </>
      ) : null}
    </main>
  );
}

function WishlistContent({
  data,
  offline,
  retrying,
  alertRef,
  shareRef,
  disableRef,
  sharing,
  onRetry,
  onAdd,
  onEdit,
  onShare,
  onDisable,
}: {
  data: WishlistData;
  offline: boolean;
  retrying: boolean;
  alertRef: React.RefObject<HTMLDivElement | null>;
  shareRef: React.RefObject<HTMLButtonElement | null>;
  disableRef: React.RefObject<HTMLButtonElement | null>;
  sharing: boolean;
  onRetry: () => void;
  onAdd: () => void;
  onEdit: (item: WishItem) => void;
  onShare: () => void;
  onDisable: () => void;
}) {
  const now = data.readAt;
  const free = freeItems(data.items);
  const taken = takenItems(data.items);
  const occasion = occasionView(data.child.birthDate, now);
  const share = shareView(data);
  const empty = data.items.length === 0;
  const showShare = !empty || share.kind === "active";

  return (
    <>
      <div className="profilo-testa profilo-testa--riga">
        <Avatar
          name={data.child.name}
          color={data.child.color}
          size="l"
          nameShown
        />
        <h1 className="t-titolo-pagina" tabIndex={-1}>
          I desideri di {data.child.name}
        </h1>
        {empty ? null : (
          <button
            type="button"
            className="btn-secondary btn--piccolo profilo-testa__azione"
            aria-haspopup="dialog"
            onClick={onAdd}
          >
            <Icon name="plus" />
            <span className="btn__testo">Aggiungi un&apos;idea</span>
          </button>
        )}
      </div>

      {offline ? (
        <div ref={alertRef}>
          <Alert
            variant="errore"
            icon="wifi-off"
            action={
              <Button variant="link" loading={retrying} onClick={onRetry}>
                Riprova
              </Button>
            }
          >
            Sei offline. Vedi la lista aggiornata alle {formatTime(now)}; per
            cambiarla serve la connessione.
          </Alert>
        </div>
      ) : null}

      <div className="scheda riga-scadenza">
        <span className="riga-scadenza__giorni">
          {occasion.missing ? (
            <span className="riga-scadenza__numero" aria-hidden="true">
              —
            </span>
          ) : (
            <>
              <span
                className={
                  occasion.word
                    ? "riga-scadenza__numero riga-scadenza__numero--parola"
                    : "riga-scadenza__numero"
                }
              >
                {occasion.number}
              </span>
              {occasion.unit ? (
                <span className="riga-scadenza__unita">{occasion.unit}</span>
              ) : null}
            </>
          )}
        </span>
        <span className="riga-lista__testo">
          <span className="riga-lista__titolo">Compleanno</span>
          <span className="riga-lista__info">{occasion.info}</span>
        </span>
        {occasion.missing ? (
          <Link className="btn-link" href={`/figli/${data.child.id}`}>
            Aggiungila <VisuallyHidden>la data di nascita</VisuallyHidden>
          </Link>
        ) : (
          <span />
        )}
      </div>

      {showShare ? (
        <ShareBlock
          view={share}
          sharing={sharing}
          onShare={onShare}
          onDisable={onDisable}
          shareRef={shareRef}
          disableRef={disableRef}
        />
      ) : null}

      {empty ? (
        <EmptyState
          large
          title="Ancora nessuna idea"
          text="Incolla il link di un negozio o scrivi un'idea: i nonni la vedranno nella pagina condivisa."
          actions={
            <button
              type="button"
              className="btn-primary btn--pieno"
              aria-haspopup="dialog"
              onClick={onAdd}
            >
              <Icon name="plus" />
              <span className="btn__testo">Aggiungi un&apos;idea</span>
            </button>
          }
        />
      ) : null}

      {free.length > 0 ? (
        <IdeasSection title="Da regalare" items={free} onEdit={onEdit}>
          <span className="sezione__info">
            {free.length}{" "}
            <VisuallyHidden>
              {free.length === 1 ? "idea" : "idee"}
            </VisuallyHidden>
          </span>
        </IdeasSection>
      ) : null}

      {taken.length > 0 ? (
        <IdeasSection title="Già presi" items={taken} onEdit={onEdit}>
          <span className="sezione__info">
            {taken.length}{" "}
            <VisuallyHidden>
              {taken.length === 1 ? "preso" : "presi"}
            </VisuallyHidden>
            {" · "}
            {data.child.name} non lo sa
          </span>
        </IdeasSection>
      ) : null}
    </>
  );
}

function IdeasSection({
  title,
  items,
  onEdit,
  children,
}: {
  title: string;
  items: WishItem[];
  onEdit: (item: WishItem) => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <section className="sezione" aria-labelledby={titleId}>
      <div className="sezione__testa">
        <h2 className="sezione__titolo" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
      <ul className="scheda lista">
        {items.map((item) => (
          <IdeaRow key={item.id} item={item} onEdit={onEdit} />
        ))}
      </ul>
    </section>
  );
}

function IdeaRow({
  item,
  onEdit,
}: {
  item: WishItem;
  onEdit: (item: WishItem) => void;
}) {
  const taken = item.takenAt !== null;
  const info = wishlistInfoLine(item.shopName, item.note);
  const price = formatWishlistPrice(item.priceCents);
  return (
    <li
      className={
        taken
          ? "riga-regalo riga-regalo--preso riga-regalo--modificabile"
          : "riga-regalo riga-regalo--modificabile"
      }
    >
      <span className="foto" aria-hidden="true">
        {item.photoSrc ? (
          // The copy of the photo is a `data:` address: no request is made.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto__immagine" src={item.photoSrc} alt="" />
        ) : (
          <Icon name="gift" size="l" />
        )}
      </span>
      <span className="riga-lista__testo">
        <button
          type="button"
          className="riga-regalo__titolo"
          aria-haspopup="dialog"
          data-idea-id={item.id}
          onClick={() => onEdit(item)}
        >
          {item.title}
        </button>
        {taken ? (
          <span className="etichetta">
            <Icon name="check" size="s" />
            <span>
              <VisuallyHidden>Lo regala</VisuallyHidden> {item.giverName}
            </span>
          </span>
        ) : info ? (
          <span className="riga-lista__info">{info}</span>
        ) : null}
      </span>
      {price ? <span className="riga-regalo__prezzo">{price}</span> : <span />}
    </li>
  );
}
