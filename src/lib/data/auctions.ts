import { collection, doc, limit, onSnapshot, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { Auction, AuctionParticipant, AuctionPrivateState, Bid, PublicBid } from "@shared/types";

type Unsub = () => void;
type OnError = (e: Error) => void;

/** Scheduled and live auctions ordered by start time; phases are derived with the server clock. */
export function subscribeOpenAuctions(cb: (a: Auction[]) => void, onError: OnError, max = 100): Unsub {
  const q = query(collection(firebase().db, "auctions"), where("status", "in", ["scheduled", "live"]), orderBy("startsAt", "asc"), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as Auction)), onError);
}

export function subscribeEndedAuctions(cb: (a: Auction[]) => void, onError: OnError, max = 24): Unsub {
  const q = query(collection(firebase().db, "auctions"), where("status", "==", "ended"), orderBy("endsAt", "desc"), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as Auction)), onError);
}

export function subscribeAuction(id: string, cb: (a: Auction | null) => void, onError: OnError): Unsub {
  return onSnapshot(doc(firebase().db, "auctions", id), (s) => cb(s.exists() ? (s.data() as Auction) : null), onError);
}

export function subscribePublicBids(id: string, cb: (b: PublicBid[]) => void, onError: OnError, max = 50): Unsub {
  const q = query(collection(firebase().db, "auctions", id, "publicBids"), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as PublicBid)), onError);
}

export function subscribeParticipant(auctionId: string, buyerId: string, cb: (p: AuctionParticipant | null) => void, onError: OnError): Unsub {
  return onSnapshot(
    doc(firebase().db, "auctions", auctionId, "participants", buyerId),
    (s) => cb(s.exists() ? (s.data() as AuctionParticipant) : null),
    onError,
  );
}

export function subscribeAuctionPrivate(auctionId: string, cb: (p: AuctionPrivateState | null) => void, onError: OnError): Unsub {
  return onSnapshot(
    doc(firebase().db, "auctions", auctionId, "private", "state"),
    (s) => cb(s.exists() ? (s.data() as AuctionPrivateState) : null),
    onError,
  );
}

export function subscribeFarmerAuctions(farmerId: string, cb: (a: Auction[]) => void, onError: OnError): Unsub {
  const q = query(collection(firebase().db, "auctions"), where("farmerId", "==", farmerId), orderBy("startsAt", "desc"), limit(200));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as Auction)), onError);
}

export function subscribeMyBids(buyerId: string, cb: (b: Bid[]) => void, onError: OnError, extra: QueryConstraint[] = []): Unsub {
  const q = query(collection(firebase().db, "bids"), where("buyerId", "==", buyerId), ...extra, orderBy("createdAt", "desc"), limit(300));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as Bid)), onError);
}

export function subscribeMyParticipations(auctionIds: string[], buyerId: string, cb: (byAuction: Record<string, AuctionParticipant>) => void, onError: OnError): Unsub {
  const result: Record<string, AuctionParticipant> = {};
  const unsubs = auctionIds.map((id) =>
    subscribeParticipant(
      id,
      buyerId,
      (p) => {
        if (p) result[id] = p;
        else delete result[id];
        cb({ ...result });
      },
      onError,
    ),
  );
  return () => unsubs.forEach((u) => u());
}

export function subscribeAuctions(auctionIds: string[], cb: (byId: Record<string, Auction>) => void, onError: OnError): Unsub {
  const result: Record<string, Auction> = {};
  const unsubs = auctionIds.map((id) =>
    subscribeAuction(
      id,
      (a) => {
        if (a) result[id] = a;
        cb({ ...result });
      },
      onError,
    ),
  );
  return () => unsubs.forEach((u) => u());
}
