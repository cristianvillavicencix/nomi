import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useDataProvider, useDelete, useGetList, useNotify } from "ra-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  GitMerge,
  Loader2,
  Mail,
  Phone,
  Trash2,
  User,
} from "lucide-react";

import { Confirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  CONFIDENCE_LABELS,
  buildGroups,
  extractEmails,
  extractPhones,
  type DupGroup,
} from "@/modules/contacts/contactDuplicateUtils";
import { cn } from "@/lib/utils";

const MAX_CONTACTS_SCANNED = 2000;

export const FindDuplicatesPage = () => {
  const { data, isPending, refetch } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: MAX_CONTACTS_SCANNED },
    sort: { field: "last_name", order: "ASC" },
  });

  const groups = useMemo(() => buildGroups(data ?? []), [data]);

  const totalGroups =
    groups.email.length + groups.phone.length + groups.name.length;

  return (
    <div className="container max-w-5xl py-6 space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings?tab=data">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Data Import
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Find duplicate contacts
        </h1>
        <p className="text-sm text-muted-foreground">
          Scans the first {MAX_CONTACTS_SCANNED.toLocaleString()} contacts and
          groups them by shared email, phone, or name. Merge combines data into
          one contact, or delete junk duplicates you do not need.
        </p>
      </header>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
        </div>
      ) : null}

      {!isPending && (data?.length ?? 0) === 0 ? <EmptyState /> : null}

      {!isPending && (data?.length ?? 0) > 0 && totalGroups === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No duplicates found in {data?.length ?? 0} contacts. Nice.
          </CardContent>
        </Card>
      ) : null}

      {!isPending && totalGroups > 0 ? (
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              By email
              <Badge>{groups.email.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="phone">
              <Phone className="h-4 w-4 mr-2" />
              By phone
              <Badge>{groups.phone.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="name">
              <User className="h-4 w-4 mr-2" />
              By name
              <Badge>{groups.name.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {(["email", "phone", "name"] as const).map((key) => (
            <TabsContent key={key} value={key} className="space-y-3 mt-3">
              {groups[key].length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No duplicates in this dimension.
                  </CardContent>
                </Card>
              ) : (
                groups[key].map((group) => (
                  <DuplicateGroupCard
                    key={`${group.key}:${group.signal}`}
                    group={group}
                    onMerged={() => void refetch()}
                  />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </div>
  );
};

const Badge = ({ children }: { children: number }) => (
  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
    {children}
  </span>
);

const EmptyState = () => (
  <Card>
    <CardContent className="py-10 text-center text-sm text-muted-foreground">
      No contacts in this CRM yet. Import some first from{" "}
      <Link className="text-primary underline" to="/settings?tab=data">
        Settings → Data Import
      </Link>
      .
    </CardContent>
  </Card>
);

const DuplicateGroupCard = ({
  group,
  onMerged,
}: {
  group: DupGroup;
  onMerged: () => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [deleteOne, { isPending: isDeletingOne }] = useDelete<Contact>();
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleteLosersOpen, setDeleteLosersOpen] = useState(false);
  const [winnerId, setWinnerId] = useState<string | number>(
    group.contacts[0].id,
  );
  const losers = group.contacts.filter((contact) => contact.id !== winnerId);
  const confidenceBadge = CONFIDENCE_LABELS[group.confidence];
  const mergeDisabled = group.confidence === "do_not_merge";

  const invalidateAndRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    onMerged();
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let mergedCount = 0;
      for (const loser of losers) {
        await dataProvider.mergeContacts(loser.id, winnerId);
        mergedCount += 1;
      }
      return mergedCount;
    },
    onSuccess: (mergedCount) => {
      notify(`Merged ${mergedCount} contact${mergedCount === 1 ? "" : "s"}`, {
        type: "success",
      });
      invalidateAndRefresh();
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Merge failed", {
        type: "error",
        multiLine: true,
      });
    },
  });

  const { mutate: deleteLosers, isPending: isDeletingLosers } = useMutation({
    mutationFn: async () => {
      for (const loser of losers) {
        await dataProvider.delete("contacts", {
          id: loser.id,
          previousData: loser,
        });
      }
      return losers.length;
    },
    onSuccess: (deletedCount) => {
      notify(
        `Deleted ${deletedCount} contact${deletedCount === 1 ? "" : "s"}`,
        {
          type: "info",
        },
      );
      setDeleteLosersOpen(false);
      invalidateAndRefresh();
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Delete failed", {
        type: "error",
      });
    },
  });

  const handleDeleteOne = () => {
    if (!deleteTarget) return;
    deleteOne(
      "contacts",
      { id: deleteTarget.id, previousData: deleteTarget },
      {
        onSuccess: () => {
          notify("Contact deleted", { type: "info" });
          setDeleteTarget(null);
          invalidateAndRefresh();
        },
        onError: (error) => {
          notify(error instanceof Error ? error.message : "Delete failed", {
            type: "error",
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {group.key === "email" ? <Mail className="h-4 w-4" /> : null}
            {group.key === "phone" ? <Phone className="h-4 w-4" /> : null}
            {group.key === "name" ? <User className="h-4 w-4" /> : null}
            <code className="text-sm">{group.signal}</code>
          </CardTitle>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              confidenceBadge.className,
            )}
          >
            {confidenceBadge.label}
          </span>
        </div>
        <CardDescription>{group.confidenceReason}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {group.contacts.map((contact) => {
            const checked = contact.id === winnerId;
            return (
              <li
                key={contact.id}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3",
                  checked ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <input
                  type="radio"
                  className="mt-1"
                  name={`winner-${group.key}-${group.signal}`}
                  checked={checked}
                  onChange={() => setWinnerId(contact.id)}
                  aria-label={`Keep ${contact.first_name ?? ""} ${
                    contact.last_name ?? ""
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Link
                      to={`/contacts/${contact.id}/show`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {[contact.first_name, contact.last_name]
                        .filter(Boolean)
                        .join(" ") || "(no name)"}
                    </Link>
                    {checked ? (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                        Keep
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {extractEmails(contact).join(", ") || "no email"} ·{" "}
                    {extractPhones(contact).join(", ") || "no phone"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={isDeletingOne || isDeletingLosers || isPending}
                  aria-label={`Delete ${contact.first_name ?? ""} ${
                    contact.last_name ?? ""
                  }`}
                  onClick={() => setDeleteTarget(contact)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <div className="flex flex-col gap-2 border-t px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        {mergeDisabled ? (
          <p className="text-xs text-muted-foreground">
            Do not merge these — likely separate people. Delete only if a row is
            junk or a mistake.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Merge keeps all emails and phones on one contact. Delete removes a
            record permanently (tasks and notes on that contact are removed).
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={
              isPending ||
              isDeletingLosers ||
              isDeletingOne ||
              losers.length === 0
            }
            onClick={() => setDeleteLosersOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete others ({losers.length})
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isPending || losers.length === 0 || mergeDisabled}
            onClick={() => {
              if (losers.length === 0 || mergeDisabled) return;
              if (
                !window.confirm(
                  `Merge ${losers.length} contact${
                    losers.length === 1 ? "" : "s"
                  } into the selected one? All emails and phones will be combined.`,
                )
              ) {
                return;
              }
              mutate();
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Merging…
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-2" /> Merge into selected
              </>
            )}
          </Button>
        </div>
      </div>

      <Confirm
        isOpen={Boolean(deleteTarget)}
        loading={isDeletingOne}
        title="Delete this contact?"
        content="This permanently removes the contact. Linked tasks and notes on this contact will also be deleted. Use Merge if you want to keep their history on another record."
        confirm="Delete"
        confirmColor="warning"
        onConfirm={handleDeleteOne}
        onClose={() => setDeleteTarget(null)}
      />

      <Confirm
        isOpen={deleteLosersOpen}
        loading={isDeletingLosers}
        title={`Delete ${losers.length} contact${losers.length === 1 ? "" : "s"}?`}
        content={`This keeps the selected contact and permanently deletes the other ${losers.length} in this group. Their tasks and notes will be removed.`}
        confirm="Delete others"
        confirmColor="warning"
        onConfirm={() => deleteLosers()}
        onClose={() => setDeleteLosersOpen(false)}
      />
    </Card>
  );
};
