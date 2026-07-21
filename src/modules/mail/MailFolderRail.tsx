import {
  Tray,
  PaperPlaneTilt,
  PencilSimpleLine,
  Trash,
  Prohibit,
  Tag,
  Plus,
  CaretDown,
  Check,
} from "@phosphor-icons/react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  MailAccountAvatar,
  MailAllAccountsAvatar,
} from "./mailAccountAvatar";
import { mailboxesSettingsPath } from "./mailSettingsPath";
import type { MailAccount, MailLabel } from "./types";

export type MailFolderId = "inbox" | "sent" | "draft" | "trash" | "spam";

const FOLDERS: Array<{
  id: MailFolderId;
  label: string;
  icon: typeof Tray;
}> = [
  { id: "inbox", label: "Inbox", icon: Tray },
  { id: "sent", label: "Sent", icon: PaperPlaneTilt },
  { id: "draft", label: "Drafts", icon: PencilSimpleLine },
  { id: "spam", label: "Spam", icon: Prohibit },
  { id: "trash", label: "Trash", icon: Trash },
];

function accountLabel(account: MailAccount) {
  return account.display_name?.trim() || account.email;
}

function MailboxSwitcher({
  accounts,
  accountFilter,
  onAccountFilterChange,
  selectedAccount,
}: {
  accounts: MailAccount[];
  accountFilter: number | "all";
  onAccountFilterChange: (id: number | "all") => void;
  selectedAccount: MailAccount | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto w-full justify-between gap-2 border-0 bg-muted/40 px-2 py-2 shadow-none hover:bg-muted/60"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedAccount ? (
              <MailAccountAvatar account={selectedAccount} />
            ) : (
              <MailAllAccountsAvatar />
            )}
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">
                {selectedAccount ? accountLabel(selectedAccount) : "All mailboxes"}
              </span>
              {selectedAccount ? (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {selectedAccount.email}
                </span>
              ) : (
                <span className="block text-[11px] text-muted-foreground">
                  {accounts.length} connected
                </span>
              )}
            </span>
          </span>
          <CaretDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        <DropdownMenuLabel>Mailboxes</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAccountFilterChange("all")}>
          <MailAllAccountsAvatar className="size-6" />
          <span className="flex-1">All mailboxes</span>
          {accountFilter === "all" ? (
            <Check className="size-4 text-primary" weight="bold" />
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.id}
            onClick={() => onAccountFilterChange(account.id)}
          >
            <MailAccountAvatar account={account} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{accountLabel(account)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {account.email}
              </span>
            </span>
            {accountFilter === account.id ? (
              <Check className="size-4 shrink-0 text-primary" weight="bold" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={mailboxesSettingsPath()} className="cursor-pointer">
            Manage mailboxes…
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MailFolderRail({
  folder,
  onFolderChange,
  accounts,
  accountFilter,
  onAccountFilterChange,
  labels,
  labelId,
  onLabelChange,
  onCompose,
  className,
}: {
  folder: MailFolderId;
  onFolderChange: (folder: MailFolderId) => void;
  accounts: MailAccount[];
  accountFilter: number | "all";
  onAccountFilterChange: (id: number | "all") => void;
  labels: MailLabel[];
  labelId: number | null;
  onLabelChange: (id: number | null) => void;
  onCompose: () => void;
  className?: string;
}) {
  const selectedAccount =
    accountFilter === "all"
      ? null
      : accounts.find((a) => a.id === accountFilter) ?? null;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[220px] shrink-0 flex-col bg-muted/25",
        className,
      )}
    >
      <div className="shrink-0 p-3">
        <Button
          type="button"
          className="w-full justify-center gap-2"
          onClick={onCompose}
        >
          <Plus className="size-4" weight="bold" />
          Compose
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <nav className="space-y-0.5">
          {FOLDERS.map((item) => {
            const Icon = item.icon;
            const active = folder === item.id && labelId == null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onLabelChange(null);
                  onFolderChange(item.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
                  active
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <Icon
                  className="size-4 shrink-0"
                  weight={active ? "fill" : "regular"}
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        {labels.length > 0 ? (
          <>
            <p className="mb-1.5 mt-4 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Labels
            </p>
            <nav className="space-y-0.5">
              {labels.map((label) => {
                const active = labelId === label.id;
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => {
                      onFolderChange("inbox");
                      onLabelChange(label.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
                      active
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Tag
                      className="size-4 shrink-0"
                      style={label.color ? { color: label.color } : undefined}
                    />
                    <span className="truncate">{label.name}</span>
                  </button>
                );
              })}
            </nav>
          </>
        ) : null}
      </div>

      <div className="mt-auto shrink-0 p-2">
        <MailboxSwitcher
          accounts={accounts}
          accountFilter={accountFilter}
          onAccountFilterChange={onAccountFilterChange}
          selectedAccount={selectedAccount}
        />
      </div>
    </aside>
  );
}
