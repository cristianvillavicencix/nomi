import { useGetMany } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { ClientSubscription } from "@/modules/types";
import { billToSelectionFromClient } from "@/modules/billing/billingUtils";
import {
  formatSavedCardLabel,
  formatSavedCardMask,
  savedCardSourceLabel,
  useClientSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SubscriptionSavedCardsTabProps = {
  subscription: ClientSubscription;
};

export const SubscriptionSavedCardsTab = ({
  subscription,
}: SubscriptionSavedCardsTabProps) => {
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

  const billTo = billToSelectionFromClient({
    company: companies[0],
    contact: contacts[0],
  });
  const { allSavedCards, isPending } = useClientSavedPaymentMethod(billTo);

  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground">Loading saved cards…</p>
    );
  }

  if (!allSavedCards.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No saved cards for this client yet. Send a setup link or collect a card
        on an invoice to add one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {allSavedCards.map((card) => (
          <Badge
            key={`${card.source}-${card.brand}-${card.last4}`}
            variant="secondary"
            className="gap-1.5 px-3 py-1.5 font-mono text-sm"
          >
            <span className="font-sans font-medium capitalize">
              {card.brand ?? "Card"}
            </span>
            <span>{formatSavedCardMask(card.last4)}</span>
          </Badge>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Card</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Last updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allSavedCards.map((card) => (
              <TableRow key={`${card.source}-${card.brand}-${card.last4}`}>
                <TableCell className="font-medium">
                  {formatSavedCardLabel(card)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {savedCardSourceLabel(card.source)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {card.updatedAt
                    ? new Date(card.updatedAt).toLocaleDateString("en-US")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
