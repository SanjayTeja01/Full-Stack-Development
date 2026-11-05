"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, MessageSquare, Tags } from "lucide-react";
import { call, errorMessage } from "@/lib/firebase/callable";
import { useAuth } from "@/components/auth/auth-provider";
import { saveProduct, unsaveProduct, useIsSaved } from "@/lib/data/saved";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function useStartConversation() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const start = async (farmerId: string, productId: string | null, withOffer = false) => {
    setBusy(true);
    try {
      const { conversationId } = await call<{ farmerId: string; productId: string | null }, { conversationId: string }>("startConversation", {
        farmerId,
        productId,
      });
      router.push(`/messages/${conversationId}${withOffer ? "?offer=1" : ""}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  return { start, busy };
}

export function ProductBuyerActions({ farmerId, productId, productName, canTrade }: { farmerId: string; productId: string; productName: string; canTrade: boolean }) {
  const { status, role, user } = useAuth();
  const pathname = usePathname();
  const { start, busy } = useStartConversation();
  const saved = useIsSaved(user?.uid, "savedProducts", productId);
  const toast = useToast();

  if (status === "loading") return <div className="h-10" />;
  if (status === "signed_out")
    return (
      <div className="space-y-2">
        <Button asChild className="w-full">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in to contact the farmer</Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link href="/register?role=buyer" className="text-primary hover:underline">
            Create a buyer account
          </Link>
        </p>
      </div>
    );
  if (user?.uid === farmerId)
    return (
      <Button asChild variant="secondary" className="w-full">
        <Link href={`/farmer/products/${productId}/edit`}>Edit this listing</Link>
      </Button>
    );
  if (role !== "buyer") return <p className="text-sm text-muted-foreground">Only buyer accounts can contact farmers about listings.</p>;
  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={() => start(farmerId, productId, true)} loading={busy} disabled={!canTrade}>
        <Tags /> Make an offer
      </Button>
      <Button variant="secondary" className="w-full" onClick={() => start(farmerId, productId)} disabled={busy}>
        <MessageSquare /> Message the farmer
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        aria-pressed={saved}
        onClick={async () => {
          try {
            if (saved) await unsaveProduct(user!.uid, productId);
            else await saveProduct(user!.uid, productId, productName);
            toast.success(saved ? "Removed from saved." : "Saved to your list.");
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      >
        <Heart className={saved ? "fill-danger text-danger" : ""} /> {saved ? "Saved" : "Save product"}
      </Button>
      {!canTrade && <p className="text-xs text-muted-foreground">This listing is not accepting offers right now. You can still message the farmer.</p>}
    </div>
  );
}
