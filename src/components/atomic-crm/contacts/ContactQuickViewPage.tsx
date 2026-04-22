import { useEffect, useMemo, useState } from "react";
import { ShowBase, useGetList, useStore } from "ra-core";
import { useNavigate, useParams } from "react-router";
import type { Contact } from "../types";
import { QuickMasterDetailLayout, type QuickNavItem } from "../layout/QuickMasterDetailLayout";
import { ContactShowContent } from "./ContactShow";

const normalize = (value?: string | null) => String(value ?? "").trim().toLowerCase();

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => email.email?.trim())?.email ?? "";

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => phone.number?.trim())?.number ?? "";

export const ContactQuickViewPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useStore<boolean>(
    "contacts-quicknav-collapsed",
    false,
  );
  const [lastSelectedId, setLastSelectedId] = useStore<string | null>(
    "contacts-quicknav-last-selected",
    null,
  );

  const { data: contacts = [], isPending } = useGetList<Contact>(
    "contacts_summary",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const items = useMemo<QuickNavItem[]>(
    () =>
      contacts.map((contact) => ({
        id: String(contact.id),
        title: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed contact",
        subtitle: contact.company_name ?? undefined,
        meta: getPrimaryEmail(contact) || getPrimaryPhone(contact) || undefined,
      })),
    [contacts],
  );

  const filteredItems = useMemo(() => {
    const term = normalize(query);
    if (!term) return items;
    return items.filter((item) =>
      [item.title, item.subtitle, item.meta].some((field) => normalize(field).includes(term)),
    );
  }, [items, query]);

  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const selectedId = id && itemIds.has(String(id)) ? String(id) : null;

  useEffect(() => {
    if (selectedId) {
      setLastSelectedId(selectedId);
      return;
    }
    if (isPending || items.length === 0) return;
    const fallbackId =
      (lastSelectedId && itemIds.has(lastSelectedId) ? lastSelectedId : null) ?? items[0]?.id;
    if (!fallbackId) return;
    navigate(`/contacts/${fallbackId}/show`, { replace: true });
  }, [selectedId, isPending, items, itemIds, lastSelectedId, navigate, setLastSelectedId]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <QuickMasterDetailLayout
        sidebarTitle="Contacts"
        sidebarSubtitle="Quick navigation for contacts"
        searchPlaceholder={`Search contacts (${items.length})`}
        mobileBrowseLabel="Browse contacts"
        items={filteredItems}
        selectedId={selectedId}
        query={query}
        onQueryChange={setQuery}
        onSelect={(nextId) => {
          setLastSelectedId(nextId);
          navigate(`/contacts/${nextId}/show`);
        }}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        isLoading={isPending}
        scrollStorageKey="contacts-quicknav-scroll-top"
      >
        <div className="h-full min-h-0 overflow-y-auto">
          {selectedId ? (
            <ShowBase resource="contacts" id={selectedId}>
              <ContactShowContent />
            </ShowBase>
          ) : null}
        </div>
      </QuickMasterDetailLayout>
    </div>
  );
};
