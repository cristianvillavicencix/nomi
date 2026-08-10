import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { ClientSubscription } from "@/modules/types";

const shouldAutoSyncSubscription = (subscription: ClientSubscription) => {
  if (subscription.status !== "pending_setup") return false;
  return Boolean(
    subscription.stripe_checkout_session_id?.trim() ||
      subscription.stripe_customer_id?.trim(),
  );
};

type SyncStripeResult = {
  synced?: boolean;
  invoices_backfilled?: { mirrored?: number; skipped?: number };
};

export const useSubscriptionStripeSync = (
  subscription: ClientSubscription | undefined,
  options?: { enabled?: boolean },
) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const syncedForIdRef = useRef<number | null>(null);

  const syncMutation = useMutation({
    mutationFn: () =>
      dataProvider.manageClientSubscription({
        subscriptionId: subscription!.id,
        action: "sync_stripe",
      }),
    onSuccess: (result: SyncStripeResult) => {
      refresh();
      const mirrored = result.invoices_backfilled?.mirrored ?? 0;
      if (mirrored > 0) {
        notify(
          `Synced from Stripe (${mirrored} invoice${mirrored === 1 ? "" : "s"} imported)`,
          { type: "success" },
        );
        return;
      }
      if (result.synced) {
        notify("Subscription synced from Stripe", { type: "success" });
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Could not sync subscription from Stripe", {
        type: "error",
      });
    },
  });

  const mutateRef = useRef(syncMutation.mutate);
  mutateRef.current = syncMutation.mutate;

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!subscription || !shouldAutoSyncSubscription(subscription)) return;
    if (syncedForIdRef.current === subscription.id) return;

    syncedForIdRef.current = subscription.id;
    mutateRef.current();
  }, [
    options?.enabled,
    subscription?.id,
    subscription?.status,
    subscription?.stripe_checkout_session_id,
    subscription?.stripe_customer_id,
  ]);

  return {
    syncFromStripe: () => syncMutation.mutate(),
    isSyncing: syncMutation.isPending,
  };
};
