import { useMemo } from "react";
import { useGetList, useDataProvider, type Identifier } from "ra-core";
import { useMutation } from "@tanstack/react-query";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/modules/types";
import type { FormInstance } from "@/modules/forms/types";

const resolveShareUrl = (
  result: { url: string; short_url?: string },
  origin: string,
) => {
  if (result.short_url) {
    return result.short_url.startsWith("http")
      ? result.short_url
      : `${origin}${result.short_url}`;
  }
  return result.url.startsWith("http") ? result.url : `${origin}${result.url}`;
};

export const useSmsWebFormInsert = ({
  contact,
  dealId,
  onInsertLink,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  onInsertLink: (url: string, label: string) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data: forms = [] } = useGetList<FormInstance>(
    "form_instances",
    {
      filter: { "is_active@eq": true },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const generateMutation = useMutation({
    mutationFn: (form: FormInstance) =>
      dataProvider.generateFormToken({
        formInstanceId: Number(form.id),
        contactId: contact?.id != null ? Number(contact.id) : null,
        companyId:
          contact?.company_id != null ? Number(contact.company_id) : null,
        dealId: dealId != null ? Number(dealId) : null,
        expiresInDays: 30,
        maxUses: 1,
      }),
    onSuccess: (result, form) => {
      const url = resolveShareUrl(result, window.location.origin);
      onInsertLink(url, form.name?.trim() || "Form");
    },
  });

  const activeForms = useMemo(
    () => forms.filter((form) => form.is_active !== false),
    [forms],
  );

  return { activeForms, generateMutation };
};
