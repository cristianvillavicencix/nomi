import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useGetOne } from "ra-core";
import { resolveSubscriptionSubview, resolveSubscriptionPaymentMode } from "@/modules/billing/subscriptions/billingNavigation";
import { SubscriptionDetailTabs } from "@/modules/billing/subscriptions/SubscriptionDetailTabs";
import {
  SubscriptionDetailHeader,
  SubscriptionDetailToolbar,
} from "@/modules/billing/subscriptions/SubscriptionDetailToolbar";
import {
  SubscriptionFormEditor,
  type SubscriptionFormEditorHandle,
} from "@/modules/billing/subscriptions/SubscriptionFormEditor";
import { SubscriptionInvoiceHistoryTab } from "@/modules/billing/subscriptions/SubscriptionInvoiceHistoryTab";
import { SubscriptionOverviewTab } from "@/modules/billing/subscriptions/SubscriptionOverviewTab";
import { SubscriptionSavedCardsTab } from "@/modules/billing/subscriptions/SubscriptionSavedCardsTab";
import type { ClientSubscription } from "@/modules/types";

type StandaloneSubscriptionEditPageProps = {
  embedded?: boolean;
  subscriptionId?: string;
};

export const StandaloneSubscriptionEditPage = ({
  subscriptionId = "",
}: StandaloneSubscriptionEditPageProps) => {
  const [searchParams] = useSearchParams();
  const subview = resolveSubscriptionSubview(searchParams);
  const formRef = useRef<SubscriptionFormEditorHandle>(null);
  const [toolbarState, setToolbarState] = useState({
    canSubmit: false,
    isPending: false,
  });

  const { data: subscription, isPending } = useGetOne<ClientSubscription>(
    "client_subscriptions",
    { id: subscriptionId },
    { enabled: Boolean(subscriptionId) },
  );

  if (isPending || !subscription) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const isEditView = subview === "edit";
  const initialPaymentMode = resolveSubscriptionPaymentMode(searchParams);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-background px-3 py-2.5 md:px-4">
        <div className="flex flex-col gap-3">
          <SubscriptionDetailHeader subscription={subscription} />
          <SubscriptionDetailToolbar
            subscription={subscription}
            activeSubview={subview}
            isPending={toolbarState.isPending}
            canSave={toolbarState.canSubmit && isEditView}
            onSave={() => formRef.current?.submit()}
          />
          <SubscriptionDetailTabs />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-4">
        {subview === "overview" ? (
          <SubscriptionOverviewTab subscription={subscription} />
        ) : null}
        {subview === "invoices" ? (
          <SubscriptionInvoiceHistoryTab
            subscriptionId={String(subscription.id)}
          />
        ) : null}
        {subview === "cards" ? (
          <SubscriptionSavedCardsTab subscription={subscription} />
        ) : null}
        {isEditView ? (
          <SubscriptionFormEditor
            ref={formRef}
            mode="edit"
            subscription={subscription}
            readOnly={subscription.status === "canceled"}
            hideReviewActions
            scrollContainer="parent"
            initialPaymentMode={initialPaymentMode}
            onStateChange={setToolbarState}
          />
        ) : null}
      </div>
    </div>
  );
};
