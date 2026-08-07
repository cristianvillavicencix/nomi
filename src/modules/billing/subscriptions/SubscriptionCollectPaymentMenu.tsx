import { ChevronDown, CreditCard, Link2, Wallet } from "lucide-react";
import { useMemo } from "react";
import { useGetMany } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { billToSelectionFromClient } from "@/modules/billing/billingUtils";
import {
  subscriptionPaymentModeLabel,
  type SubscriptionPaymentMode,
} from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
import { useClientSavedPaymentMethod } from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import type { ClientSubscription } from "@/modules/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SubscriptionCollectPaymentMenuProps = {
  subscription: ClientSubscription;
  disabled?: boolean;
  onUseSavedCard: () => void;
  onEnterStaffCard: () => void;
  onRequestClientCard: () => void;
  className?: string;
};

export const SubscriptionCollectPaymentMenu = ({
  subscription,
  disabled = false,
  onUseSavedCard,
  onEnterStaffCard,
  onRequestClientCard,
  className,
}: SubscriptionCollectPaymentMenuProps) => {
  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription.company_id ? [subscription.company_id] : [] },
    { enabled: Boolean(subscription.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription.contact_id ? [subscription.contact_id] : [] },
    { enabled: Boolean(subscription.contact_id) },
  );

  const billTo = useMemo(
    () =>
      billToSelectionFromClient({
        company: companies[0],
        contact: contacts[0],
      }),
    [companies, contacts],
  );

  const { savedCard } = useClientSavedPaymentMethod(billTo);
  const hasSavedCard = Boolean(
    savedCard || subscription.payment_method_last4?.trim(),
  );

  const options: Array<{
    mode: SubscriptionPaymentMode;
    label: string;
    description: string;
    icon: typeof Wallet;
    disabled?: boolean;
    onSelect: () => void;
  }> = [
    {
      mode: "saved_card",
      label: subscriptionPaymentModeLabel("saved_card"),
      description: "Charge the client's saved card now",
      icon: Wallet,
      disabled: !hasSavedCard,
      onSelect: onUseSavedCard,
    },
    {
      mode: "staff_card",
      label: subscriptionPaymentModeLabel("staff_card"),
      description: "Open Edit to enter the card with the client",
      icon: CreditCard,
      onSelect: onEnterStaffCard,
    },
    {
      mode: "request_setup",
      label: subscriptionPaymentModeLabel("request_setup"),
      description: "Send a secure setup link by email or SMS",
      icon: Link2,
      onSelect: onRequestClientCard,
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 gap-1.5 rounded-none px-2.5 text-xs font-medium",
            className,
          )}
        >
          <CreditCard className="size-3.5" />
          Collect payment
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {options.map(({ mode, label, description, icon: Icon, disabled: itemDisabled, onSelect }) => (
          <DropdownMenuItem
            key={mode}
            disabled={itemDisabled}
            onSelect={onSelect}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="flex items-center gap-2 font-medium">
              <Icon className="size-4" />
              {label}
            </span>
            <span className="pl-6 text-xs text-muted-foreground">{description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
