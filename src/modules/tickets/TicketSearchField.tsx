import { Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatModuleItemCount } from "@/components/atomic-crm/layout/ModuleToolbar";
import {
  formatTicketRelativeTime,
  ticketStatusLabel,
} from "@/modules/tickets/ticketInboxConfig";
import { formatTicketCardSubject } from "@/modules/tickets/ticketOverviewConfig";
import type { Ticket } from "@/modules/types";

const MIN_QUERY_LENGTH = 1;
const MAX_SUGGESTIONS = 8;

const clientLabelForTicket = (
  ticket: Ticket,
  companyById?: Map<string, Company>,
  contactById?: Map<string, Contact>,
) => {
  const company = companyById?.get(String(ticket.company_id ?? ""));
  if (company?.name?.trim()) return company.name.trim();
  const contact = contactById?.get(String(ticket.contact_id ?? ""));
  if (contact) {
    const name = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (name) return name;
  }
  return (
    ticket.requester_name?.trim() ||
    ticket.requester_email?.trim() ||
    null
  );
};

type TicketSearchFieldProps = {
  value: string;
  onChange: (next: string) => void;
  tickets: Ticket[];
  onSelectTicket: (ticketId: string) => void;
  companyById?: Map<string, Company>;
  contactById?: Map<string, Contact>;
  basePlaceholder: string;
  total?: number | null;
  itemSingular?: string;
  itemPlural?: string;
  className?: string;
  inputClassName?: string;
  /** When true, keep filtering the page list; picking a row still opens the ticket. */
  isSearchingHint?: boolean;
};

export function TicketSearchField({
  value,
  onChange,
  tickets,
  onSelectTicket,
  companyById,
  contactById,
  basePlaceholder,
  total,
  itemSingular,
  itemPlural,
  className,
  inputClassName,
}: TicketSearchFieldProps) {
  const isMobile = useIsMobile();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = value.trim();
  const canSuggest = trimmed.length >= MIN_QUERY_LENGTH;

  const suggestions = useMemo(() => {
    if (!canSuggest) return [] as Ticket[];
    return tickets.slice(0, MAX_SUGGESTIONS);
  }, [canSuggest, tickets]);

  const open = focused && canSuggest && suggestions.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmed, suggestions.length]);

  const countLabel =
    itemSingular != null
      ? formatModuleItemCount(total, itemSingular, itemPlural)
      : null;
  const placeholder = countLabel
    ? `${basePlaceholder} · ${countLabel}`
    : basePlaceholder;
  const ariaLabel = countLabel
    ? `Search among ${countLabel}`
    : basePlaceholder;
  const hasValue = value.length > 0;

  const pick = (ticketId: string) => {
    onSelectTicket(ticketId);
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <Popover open={open} onOpenChange={() => undefined} modal={false}>
        <PopoverAnchor asChild>
          <div
            className={cn(
              "relative w-full",
              isMobile ? "max-w-none" : "sm:max-w-lg",
            )}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={value}
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                open && suggestions[activeIndex]
                  ? `${listId}-option-${suggestions[activeIndex]!.id}`
                  : undefined
              }
              onChange={(event) => onChange(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                // Delay so suggestion click can fire before close.
                window.setTimeout(() => setFocused(false), 120);
              }}
              onKeyDown={(event) => {
                if (!open) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((current) =>
                    Math.min(current + 1, suggestions.length - 1),
                  );
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(current - 1, 0));
                  return;
                }
                if (event.key === "Enter") {
                  const ticket = suggestions[activeIndex];
                  if (!ticket) return;
                  event.preventDefault();
                  pick(String(ticket.id));
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setFocused(false);
                  inputRef.current?.blur();
                }
              }}
              placeholder={placeholder}
              aria-label={ariaLabel}
              className={cn(
                isMobile ? "h-11" : "h-8",
                "pl-9",
                hasValue && "pr-9",
                isMobile &&
                  "rounded-full border-0 bg-black/[0.06] shadow-none dark:bg-white/10",
                inputClassName,
              )}
              autoComplete="off"
            />
            {hasValue ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange("")}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] max-w-lg p-1"
        >
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto">
            {suggestions.map((ticket, index) => {
              const ticketId = String(ticket.id);
              const active = index === activeIndex;
              const client = clientLabelForTicket(
                ticket,
                companyById,
                contactById,
              );
              return (
                <li key={ticketId} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-option-${ticket.id}`}
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/70",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(ticketId)}
                  >
                    <span className="truncate text-sm font-medium">
                      #{ticketId} · {formatTicketCardSubject(ticket.subject)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[
                        ticketStatusLabel(ticket.status),
                        client,
                        formatTicketRelativeTime(
                          ticket.last_message_at ?? ticket.updated_at,
                        ),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {tickets.length > MAX_SUGGESTIONS ? (
            <p className="border-t px-2.5 py-1.5 text-xs text-muted-foreground">
              Showing {MAX_SUGGESTIONS} of {tickets.length} matches — keep
              typing to narrow
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
