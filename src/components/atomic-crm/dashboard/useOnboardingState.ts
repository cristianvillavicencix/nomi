import { useGetList } from "ra-core";

import type { Contact, ContactNote } from "../types";

export type OnboardingState = {
  totalContact: number | undefined;
  totalContactNotes: number | undefined;
  firstContactId: Contact["id"] | undefined;
  isPending: boolean;
};

export const useOnboardingState = (): OnboardingState => {
  const {
    data: contactData,
    total: totalContact,
    isPending: isPendingContact,
  } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1 },
  });

  const { total: totalContactNotes, isPending: isPendingContactNotes } =
    useGetList<ContactNote>("contact_notes", {
      pagination: { page: 1, perPage: 1 },
    });

  return {
    totalContact,
    totalContactNotes,
    firstContactId: contactData?.[0]?.id,
    isPending: isPendingContact || isPendingContactNotes,
  };
};
