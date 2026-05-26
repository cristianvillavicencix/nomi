import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useDataProvider, useGetList, useNotify } from "ra-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GitMerge, Loader2, Mail, Phone, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

const MAX_CONTACTS_SCANNED = 2000;

type DupKey = "email" | "phone" | "name";

type DupGroup = {
  key: DupKey;
  signal: string;
  contacts: Contact[];
};

const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizePhone = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
};

const normalizeName = (first?: string | null, last?: string | null) => {
  const parts = [first, last]
    .map((p) => (typeof p === "string" ? p.trim().toLowerCase() : ""))
    .filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  return parts.join(" ");
};

const extractEmails = (contact: Contact): string[] => {
  const raw = contact.email_jsonb;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return normalizeEmail(entry);
      if (entry && typeof entry === "object" && "email" in entry) {
        return normalizeEmail((entry as { email: unknown }).email);
      }
      return null;
    })
    .filter((email): email is string => email !== null);
};

const extractPhones = (contact: Contact): string[] => {
  const raw = contact.phone_jsonb;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return normalizePhone(entry);
      if (entry && typeof entry === "object" && "number" in entry) {
        return normalizePhone((entry as { number: unknown }).number);
      }
      return null;
    })
    .filter((phone): phone is string => phone !== null);
};

const buildGroups = (contacts: Contact[]): Record<DupKey, DupGroup[]> => {
  const byEmail = new Map<string, Contact[]>();
  const byPhone = new Map<string, Contact[]>();
  const byName = new Map<string, Contact[]>();

  for (const contact of contacts) {
    for (const email of extractEmails(contact)) {
      const bucket = byEmail.get(email) ?? [];
      bucket.push(contact);
      byEmail.set(email, bucket);
    }
    for (const phone of extractPhones(contact)) {
      const bucket = byPhone.get(phone) ?? [];
      bucket.push(contact);
      byPhone.set(phone, bucket);
    }
    const nameKey = normalizeName(contact.first_name, contact.last_name);
    if (nameKey) {
      const bucket = byName.get(nameKey) ?? [];
      bucket.push(contact);
      byName.set(nameKey, bucket);
    }
  }

  const toGroups = (key: DupKey, map: Map<string, Contact[]>): DupGroup[] => {
    const groups: DupGroup[] = [];
    map.forEach((items, signal) => {
      const unique = Array.from(
        new Map(items.map((c) => [c.id, c])).values(),
      );
      if (unique.length >= 2) {
        groups.push({ key, signal, contacts: unique });
      }
    });
    return groups.sort((a, b) => b.contacts.length - a.contacts.length);
  };

  return {
    email: toGroups("email", byEmail),
    phone: toGroups("phone", byPhone),
    name: toGroups("name", byName),
  };
};

export const FindDuplicatesPage = () => {
  const { data, isPending, refetch } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: MAX_CONTACTS_SCANNED },
    sort: { field: "last_name", order: "ASC" },
  });

  const groups = useMemo(
    () => buildGroups(data ?? []),
    [data],
  );

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
          groups them by shared email, phone, or name. Pick the contact you
          want to keep, then merge the rest into it.
        </p>
      </header>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
        </div>
      ) : null}

      {!isPending && (data?.length ?? 0) === 0 ? (
        <EmptyState />
      ) : null}

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
  const [winnerId, setWinnerId] = useState<string | number>(
    group.contacts[0].id,
  );
  const losers = group.contacts.filter((c) => c.id !== winnerId);

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
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onMerged();
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Merge failed", {
        type: "error",
        multiLine: true,
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {group.key === "email" ? <Mail className="h-4 w-4" /> : null}
          {group.key === "phone" ? <Phone className="h-4 w-4" /> : null}
          {group.key === "name" ? <User className="h-4 w-4" /> : null}
          <code className="text-sm">{group.signal}</code>
        </CardTitle>
        <CardDescription>
          {group.contacts.length} contacts share this {group.key}. Pick the one
          to keep — the others will be merged into it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {group.contacts.map((contact) => {
            const checked = contact.id === winnerId;
            return (
              <li
                key={contact.id}
                className={`flex items-start gap-3 rounded-md border p-3 ${
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
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
              </li>
            );
          })}
        </ul>
      </CardContent>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button
          variant="default"
          size="sm"
          disabled={isPending || losers.length === 0}
          onClick={() => {
            if (losers.length === 0) return;
            if (
              !window.confirm(
                `Merge ${losers.length} contact${
                  losers.length === 1 ? "" : "s"
                } into the selected one? This deletes the others.`,
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
    </Card>
  );
};
