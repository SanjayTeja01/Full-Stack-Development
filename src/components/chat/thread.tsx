"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, Ban, ChevronLeft, MoreVertical, RotateCcw, Send, ShieldOff, Tags, CheckCheck, Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { Conversation, Message, Offer, Product } from "@shared/types";
import { formatINR } from "@shared/money";
import { unitShort } from "@shared/units";
import { useAuth } from "@/components/auth/auth-provider";
import { markConversationRead, newMessageId, sendMessage, subscribeConversation, subscribeConversationOffers, subscribeMessages } from "@/lib/data/chat";
import { subscribeFarmerProducts, subscribeProduct } from "@/lib/data/products";
import { call, errorMessage } from "@/lib/firebase/callable";
import { useServerNow } from "@/lib/hooks/use-server-clock";
import { OfferCard } from "@/components/offers/offer-card";
import { OfferComposer } from "@/components/offers/offer-composer";
import { ReportButton } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { NativeSelect } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OutboxItem {
  id: string;
  text: string;
  status: "sending" | "failed";
}

export function Thread({ conversationId }: { conversationId: string }) {
  const { user, role } = useAuth();
  const uid = user!.uid;
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { now } = useServerNow(15_000);
  const [conv, setConv] = React.useState<Conversation | null | undefined>(undefined);
  const [messages, setMessages] = React.useState<Message[] | null>(null);
  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [farmerProducts, setFarmerProducts] = React.useState<Product[]>([]);
  const [pickedProductId, setPickedProductId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [listenerError, setListenerError] = React.useState(false);
  const [outbox, setOutbox] = React.useState<OutboxItem[]>([]);
  const [text, setText] = React.useState("");
  const [composerOpen, setComposerOpen] = React.useState(params.get("offer") === "1");
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const tradeRole = role === "farmer" ? "farmer" : "buyer";

  React.useEffect(
    () =>
      subscribeConversation(
        conversationId,
        setConv,
        (e) => setError((e as Error & { code?: string }).code === "permission-denied" ? "denied" : e.message),
      ),
    [conversationId],
  );
  React.useEffect(() => {
    if (!conv) return;
    const unsubs = [
      subscribeMessages(conversationId, (m) => {
        setMessages(m);
        setListenerError(false);
      }, () => setListenerError(true)),
      subscribeConversationOffers(conversationId, uid, tradeRole, setOffers, () => setListenerError(true)),
    ];
    return () => unsubs.forEach((u) => u());
    // Re-subscribe only when the conversation identity changes, not on every preview update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, !!conv, uid, tradeRole]);

  const productId = conv?.productId ?? pickedProductId;
  React.useEffect(() => {
    if (!productId) return;
    return subscribeProduct(productId, setProduct, () => setProduct(null));
  }, [productId]);
  const farmerId = conv?.farmerId;
  const isGeneral = conv ? !conv.productId : false;
  React.useEffect(() => {
    if (!farmerId || !isGeneral || role !== "buyer") return;
    return subscribeFarmerProducts(farmerId, (p) => setFarmerProducts(p.filter((x) => x.listingStatus === "active")), () => undefined, true);
  }, [farmerId, isGeneral, role]);

  // Mark as read whenever new messages arrive while the thread is open.
  const unread = conv?.unreadCounts?.[uid] ?? 0;
  React.useEffect(() => {
    if (unread > 0) markConversationRead(conversationId, uid).catch(() => undefined);
  }, [unread, conversationId, uid]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, outbox.length]);

  // Drop outbox entries once the server copy arrives.
  const delivered = React.useMemo(() => new Set(messages?.map((m) => m.messageId)), [messages]);
  const pending = outbox.filter((o) => !delivered.has(o.id));

  const deliver = async (item: OutboxItem) => {
    setOutbox((o) => [...o.filter((x) => x.id !== item.id), { ...item, status: "sending" }]);
    try {
      await sendMessage(conversationId, item.id, item.text);
      setOutbox((o) => o.filter((x) => x.id !== item.id));
    } catch {
      setOutbox((o) => o.map((x) => (x.id === item.id ? { ...x, status: "failed" } : x)));
    }
  };

  if (error === "denied" || conv === null)
    return (
      <div className="p-6">
        <EmptyState title="Conversation not found" description="It may not exist, or you are not a participant." action={<Button asChild variant="secondary"><Link href="/messages">Back to messages</Link></Button>} />
      </div>
    );
  if (error) return <div className="p-6"><ErrorState message="This conversation could not be loaded." onRetry={() => location.reload()} /></div>;
  if (!conv || !messages) return <Spinner label="Loading conversation" />;

  const other = conv.participantIds.find((p) => p !== uid)!;
  const otherRead = conv.lastReadAt?.[other]?.toMillis() ?? 0;
  const blocked = conv.status === "blocked";
  const openOffer = offers.find((o) => o.status === "pending" && (!o.expiresAt || now === 0 || o.expiresAt.toMillis() > now));
  const offersById = new Map(offers.map((o) => [o.offerId, o]));
  const lastMineIdx = messages.map((m) => m.senderId === uid && m.messageType === "text").lastIndexOf(true);
  const archived = conv.archivedBy.includes(uid);

  const setState = async (action: "block" | "unblock" | "archive" | "unarchive") => {
    try {
      await call("setConversationState", { conversationId, action });
      toast.success({ block: "Conversation blocked.", unblock: "Conversation unblocked.", archive: "Archived.", unarchive: "Moved to inbox." }[action]);
      if (action === "archive") router.push("/messages");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const item = "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link href="/messages" className="rounded p-1 hover:bg-muted lg:hidden" aria-label="Back to conversations">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {role === "buyer" ? <Link href={`/farmers/${other}`} className="hover:text-primary">{conv.participantNames[other]}</Link> : conv.participantNames[other]}
          </p>
          {conv.productId ? (
            <Link href={`/products/${conv.productId}`} className="block truncate text-xs text-primary hover:underline">
              {conv.productName}
              {product && ` · asking ${formatINR(product.pricePerUnit)}/${unitShort(product.unit)}`}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">General enquiry</p>
          )}
        </div>
        {role === "buyer" && !blocked && (
          <Button size="sm" onClick={() => setComposerOpen(true)} disabled={!!openOffer || !product} title={openOffer ? "An offer is already open" : undefined}>
            <Tags /> <span className="hidden sm:inline">Make offer</span>
          </Button>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="icon" variant="ghost" aria-label="Conversation options">
              <MoreVertical />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-md border border-border bg-card p-1 shadow-lg">
              {archived ? (
                <DropdownMenu.Item className={item} onSelect={() => setState("unarchive")}>
                  <ArchiveRestore className="size-4" /> Move to inbox
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item className={item} onSelect={() => setState("archive")}>
                  <Archive className="size-4" /> Archive
                </DropdownMenu.Item>
              )}
              {!blocked ? (
                <DropdownMenu.Item className={`${item} text-danger`} onSelect={() => setState("block")}>
                  <Ban className="size-4" /> Block conversation
                </DropdownMenu.Item>
              ) : (
                conv.blockedBy === uid && (
                  <DropdownMenu.Item className={item} onSelect={() => setState("unblock")}>
                    <ShieldOff className="size-4" /> Unblock
                  </DropdownMenu.Item>
                )
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      {listenerError && (
        <Alert tone="warning" className="m-3" title="Connection interrupted">
          Live updates paused. Messages will resume when your connection returns.
        </Alert>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4" aria-live="polite">
        {messages.length === 0 && pending.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Start the conversation. Ask about quality, quantity or how to inspect the produce. Use “Make offer” to propose formal terms.
          </p>
        )}
        {messages.map((m, i) => {
          const day = m.createdAt ? formatDate(m.createdAt) : "";
          const prev = messages[i - 1];
          const prevDay = prev?.createdAt ? formatDate(prev.createdAt) : "";
          const dayHeader = day && day !== prevDay ? <p className="py-1 text-center text-xs text-muted-foreground">{day}</p> : null;
          if (m.messageType === "offer" && m.relatedOfferId) {
            const o = offersById.get(m.relatedOfferId);
            return (
              <React.Fragment key={m.messageId}>
                {dayHeader}
                <div className={cn("flex", m.senderId === uid ? "justify-end" : "justify-start")}>
                  {o ? <OfferCard offer={o} uid={uid} names={conv.participantNames} product={product} now={now} /> : <div className="text-xs text-muted-foreground">{m.text}</div>}
                </div>
              </React.Fragment>
            );
          }
          if (m.messageType === "system") {
            return (
              <React.Fragment key={m.messageId}>
                {dayHeader}
                <p className="mx-auto max-w-md rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">{m.text}</p>
              </React.Fragment>
            );
          }
          const mine = m.senderId === uid;
          return (
            <React.Fragment key={m.messageId}>
              {dayHeader}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "border border-border bg-card")}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {m.createdAt ? formatTime(m.createdAt) : "Sending…"}
                    {mine && i === lastMineIdx && m.createdAt && (otherRead >= m.createdAt.toMillis() ? <><CheckCheck className="size-3" /> Seen</> : <Check className="size-3" aria-label="Delivered" />)}
                  </p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {pending.map((o) => (
          <div key={o.id} className="flex justify-end">
            <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", o.status === "failed" ? "border border-danger bg-danger-soft" : "bg-primary/70 text-primary-foreground")}>
              <p className="whitespace-pre-wrap break-words">{o.text}</p>
              {o.status === "sending" ? (
                <p className="mt-1 text-right text-[11px] opacity-75">Sending…</p>
              ) : (
                <button type="button" onClick={() => deliver(o)} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-danger">
                  <RotateCcw className="size-3" /> Not sent. Tap to retry
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {isGeneral && role === "buyer" && !blocked && (
        <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-2 text-sm">
          <label htmlFor="pick-product" className="shrink-0 text-muted-foreground">
            Offer on:
          </label>
          <NativeSelect id="pick-product" value={pickedProductId} onChange={(e) => setPickedProductId(e.target.value)} className="h-8">
            <option value="">Choose one of this farmer&apos;s listings</option>
            {farmerProducts.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.name} ({formatINR(p.pricePerUnit)}/{unitShort(p.unit)})
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {blocked ? (
        <div className="border-t border-border bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
          {conv.blockedBy === uid ? "You blocked this conversation. Unblock it to send messages." : "This conversation has been blocked. You cannot send messages."}
        </div>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t) return;
            setText("");
            deliver({ id: newMessageId(), text: t.slice(0, 2000), status: "sending" });
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            rows={1}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <Button type="submit" size="icon" aria-label="Send message" disabled={!text.trim()}>
            <Send />
          </Button>
        </form>
      )}
      <div className="flex justify-between border-t border-border bg-card px-4 py-1">
        <p className="self-center text-[11px] text-muted-foreground">Chat messages are not binding. Only accepted offers record an agreement.</p>
        <ReportButton targetType="conversation" targetId={conversationId} />
      </div>

      {product && role === "buyer" && (
        <OfferComposer open={composerOpen && !openOffer} onOpenChange={setComposerOpen} mode="offer" product={product} conversationId={conversationId} />
      )}
    </div>
  );
}
