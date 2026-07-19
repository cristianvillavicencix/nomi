import { ChevronDown, KanbanSquare, List as ListIcon, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AccountsHubView } from "@/modules/accounts/accountsHubSearchParams";
import { cn } from "@/lib/utils";

export type AccountsHubChrome = {
  activeView: AccountsHubView;
  onViewChange: (view: AccountsHubView) => void;
  showToggle?: boolean;
  canCreateCompany?: boolean;
  canCreateContact?: boolean;
  onNewCompany?: () => void;
  onNewLead?: () => void;
  onNewContact?: () => void;
};

type AccountsModuleToolbarProps = AccountsHubChrome & {
  /** Search (list) or My leads (board) — sits between view toggle and create actions. */
  leadingExtra?: ReactNode;
  className?: string;
};

const AccountsCreateSplitButton = ({
  canCreateCompany = false,
  canCreateContact = false,
  onNewCompany,
  onNewLead,
  onNewContact,
}: Pick<
  AccountsHubChrome,
  | "canCreateCompany"
  | "canCreateContact"
  | "onNewCompany"
  | "onNewLead"
  | "onNewContact"
>) => {
  const showCompany = Boolean(canCreateCompany && onNewCompany);
  const showLead = Boolean(canCreateContact && onNewLead);
  const showContact = Boolean(canCreateContact && onNewContact);

  const primary = showCompany
    ? {
        label: "New company",
        onClick: onNewCompany!,
      }
    : showLead
      ? {
          label: "New lead",
          onClick: onNewLead!,
        }
      : showContact
        ? {
            label: "New contact",
            onClick: onNewContact!,
          }
        : null;

  if (!primary) return null;

  const menuItems = [
    showCompany && primary.label !== "New company"
      ? { label: "New company", onSelect: onNewCompany! }
      : null,
    showLead && primary.label !== "New lead"
      ? { label: "New lead", onSelect: onNewLead! }
      : null,
    showContact && primary.label !== "New contact"
      ? { label: "New contact", onSelect: onNewContact! }
      : null,
  ].filter(Boolean) as Array<{ label: string; onSelect: () => void }>;

  if (menuItems.length === 0) {
    return (
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={primary.onClick}
        aria-label={primary.label}
      >
        <Plus className="size-4" />
        {primary.label}
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 items-stretch">
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="rounded-r-none"
        onClick={primary.onClick}
        aria-label={primary.label}
      >
        <Plus className="size-4" />
        {primary.label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="rounded-l-none border-l border-primary-foreground/20 px-2"
            aria-label="More create options"
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
              <Plus className="size-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/**
 * In-page Accounts chrome: view toggle + module search/filters + create actions.
 * Keeps the global header for product-wide controls only.
 */
export const AccountsModuleToolbar = ({
  activeView,
  onViewChange,
  showToggle = false,
  leadingExtra,
  canCreateCompany = false,
  canCreateContact = false,
  onNewCompany,
  onNewLead,
  onNewContact,
  className,
}: AccountsModuleToolbarProps) => (
  <div
    className={cn(
      "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3",
      className,
    )}
  >
    {leadingExtra ? (
      <div className="min-w-0 flex-1">{leadingExtra}</div>
    ) : (
      <div className="min-w-0 flex-1" />
    )}

    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
      {showToggle ? (
        <ToggleGroup
          type="single"
          value={activeView}
          onValueChange={(value) => {
            if (value === "list" || value === "board") onViewChange(value);
          }}
          variant="outline"
          size="sm"
          className="w-fit shrink-0"
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <ListIcon className="size-4" />
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label="Board view">
            <KanbanSquare className="size-4" />
            Board
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      <AccountsCreateSplitButton
        canCreateCompany={canCreateCompany}
        canCreateContact={canCreateContact}
        onNewCompany={onNewCompany}
        onNewLead={onNewLead}
        onNewContact={onNewContact}
      />
    </div>
  </div>
);
