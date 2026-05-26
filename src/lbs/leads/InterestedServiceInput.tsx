import { useMemo } from "react";
import { useGetList } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Contact } from "@/components/atomic-crm/types";

/**
 * Service autocomplete for the lead form: choices are derived from the
 * distinct non-empty values of `interested_service` already saved on
 * contacts. The user can pick an existing service or type a new one — the
 * onCreate handler returns the typed value so the column ends up holding
 * the raw text (we don't have a separate services table on purpose).
 */
export const InterestedServiceInput = () => {
  const isMobile = useIsMobile();

  const { data: contacts } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "last_seen", order: "DESC" },
    filter: { "interested_service@neq": "" },
  });

  const choices = useMemo(() => {
    const seen = new Set<string>();
    (contacts ?? []).forEach((contact) => {
      const value = contact.interested_service?.trim();
      if (value) seen.add(value);
    });
    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ id: value, name: value }));
  }, [contacts]);

  const handleCreate = (name?: string) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    return { id: trimmed, name: trimmed };
  };

  return (
    <AutocompleteInput
      source="interested_service"
      label="Service interested in"
      optionText="name"
      choices={choices}
      onCreate={handleCreate}
      createLabel="Start typing to add a new service"
      createItemLabel='Use "%{item}"'
      helperText={false}
      modal={isMobile}
    />
  );
};
