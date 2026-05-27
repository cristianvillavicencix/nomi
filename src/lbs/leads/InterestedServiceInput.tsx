import { useMemo } from "react";
import { useGetList } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { interestedServiceChoices } from "@/lbs/constants/leadSource";
import type { Contact } from "@/components/atomic-crm/types";

/**
 * Service picker for leads: starts from LBS's standard service catalog and
 * also surfaces values already used on other contacts.
 */
export const InterestedServiceInput = () => {
  const isMobile = useIsMobile();

  const { data: contacts } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "last_seen", order: "DESC" },
    filter: { "interested_service@neq": "" },
  });

  const choices = useMemo(() => {
    const seen = new Map<string, string>();
    interestedServiceChoices.forEach((entry) => {
      seen.set(entry.value, entry.label);
    });
    (contacts ?? []).forEach((contact) => {
      const value = contact.interested_service?.trim();
      if (value && !seen.has(value)) {
        seen.set(value, value);
      }
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
      createLabel="Pick a service or type a new one"
      createItemLabel='Use "%{item}"'
      helperText={false}
      modal={isMobile}
    />
  );
};
