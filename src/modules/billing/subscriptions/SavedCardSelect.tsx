import {
  formatSavedCardLabel,
  savedCardSourceLabel,
  type ClientSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import {
  FloatingFieldShell,
  floatingFieldControlClassName,
} from "@/components/ui/floating-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);

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
    const optionValue = savedCardOptionValue(card);
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(optionValue, card)}
        className="w-full text-left disabled:pointer-events-none disabled:opacity-60"
      >
        <FloatingFieldShell active label={label} htmlFor={id}>
          <div
            id={id}
            className={cn(
              floatingFieldControlClassName,
              "flex flex-col justify-center gap-0.5 py-1.5",
            )}
          >
            <span className="text-sm font-medium leading-none">
              {formatSavedCardLabel(card)}
            </span>
            <span className="text-xs text-muted-foreground">
              {savedCardSourceLabel(card.source)}
            </span>
          </div>
        </FloatingFieldShell>
      </button>
    );
  }

  return (
    <FloatingFieldShell
      active={open || Boolean(resolvedValue)}
      label={label}
      htmlFor={id}
    >
      <Select
        value={resolvedValue}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        onValueChange={(next) => {
          const card = cards.find(
            (candidate) => savedCardOptionValue(candidate) === next,
          );
          if (card) onChange(next, card);
        }}
      >
        <SelectTrigger
          id={id}
          className="h-9 border-0 bg-transparent px-3 shadow-none hover:bg-transparent focus:ring-0 data-[size=default]:h-9"
        >
          <SelectValue placeholder="Select card">
            {(() => {
              const selected =
                cards.find(
                  (card) => savedCardOptionValue(card) === resolvedValue,
                ) ?? cards[0];
              return selected ? formatSavedCardLabel(selected) : null;
            })()}
          </SelectValue>
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
    </FloatingFieldShell>
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
