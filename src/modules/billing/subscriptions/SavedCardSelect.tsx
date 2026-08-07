import {
  formatSavedCardLabel,
  savedCardSourceLabel,
  type ClientSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const savedCardOptionValue = (card: ClientSavedPaymentMethod) =>
  card.stripePaymentMethodId?.trim() ||
  `${(card.brand ?? "card").toLowerCase()}-${card.last4}`;

type SavedCardSelectProps = {
  cards: ClientSavedPaymentMethod[];
  value: string | null;
  onChange: (value: string, card: ClientSavedPaymentMethod) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
};

export const SavedCardSelect = ({
  cards,
  value,
  onChange,
  disabled = false,
  label = "Saved card",
  id = "saved-card-select",
}: SavedCardSelectProps) => {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved cards for this client yet.
      </p>
    );
  }

  const resolvedValue =
    value && cards.some((card) => savedCardOptionValue(card) === value)
      ? value
      : savedCardOptionValue(cards[0]);

  if (cards.length === 1) {
    const card = cards[0];
    return (
      <div className="space-y-1">
        {label ? <Label htmlFor={id}>{label}</Label> : null}
        <p id={id} className="text-sm font-medium">
          {formatSavedCardLabel(card)}
        </p>
        <p className="text-xs text-muted-foreground">
          {savedCardSourceLabel(card.source)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={resolvedValue}
        disabled={disabled}
        onValueChange={(next) => {
          const card = cards.find(
            (candidate) => savedCardOptionValue(candidate) === next,
          );
          if (card) onChange(next, card);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select a saved card" />
        </SelectTrigger>
        <SelectContent>
          {cards.map((card) => {
            const optionValue = savedCardOptionValue(card);
            return (
              <SelectItem key={optionValue} value={optionValue}>
                {formatSavedCardLabel(card)} · {savedCardSourceLabel(card.source)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export const resolveSavedCardPaymentMethodId = (
  cards: ClientSavedPaymentMethod[],
  selectedValue: string | null,
): string | null => {
  if (selectedValue) {
    const match = cards.find(
      (card) => savedCardOptionValue(card) === selectedValue,
    );
    if (match?.stripePaymentMethodId?.trim()) {
      return match.stripePaymentMethodId.trim();
    }
  }
  const fallback = cards.find((card) => card.stripePaymentMethodId?.trim());
  return fallback?.stripePaymentMethodId?.trim() ?? null;
};
