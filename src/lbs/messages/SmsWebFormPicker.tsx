import { useMemo } from "react";
import { useGetList, type Identifier } from "ra-core";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Contact, Form } from "@/lbs/types";
import { buildWebFormShareUrl } from "@/lbs/web-forms/webFormLinks";

export const SmsWebFormPicker = ({
  contact,
  dealId,
  onInsertLink,
  disabled,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  onInsertLink: (url: string, label: string) => void;
  disabled?: boolean;
}) => {
  const { data: forms = [] } = useGetList<Form>(
    "forms",
    {
      filter: { "active@eq": true },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const shareParams = useMemo(
    () => ({
      dealId: dealId ?? undefined,
      companyId: contact?.company_id ?? undefined,
      contactId: contact?.id ?? undefined,
    }),
    [contact?.company_id, contact?.id, dealId],
  );

  const formLinks = useMemo(
    () =>
      forms
        .map((form) => {
          if (!form.slug) return null;
          const url = buildWebFormShareUrl(
            window.location.origin,
            form.slug,
            shareParams,
          );
          if (!url) return null;
          return { form, url };
        })
        .filter((entry): entry is { form: Form; url: string } => entry != null),
    [forms, shareParams],
  );

  if (formLinks.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={disabled}
          aria-label="Insert web form link"
        >
          <FileText className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Insert form link</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formLinks.map(({ form, url }) => (
          <DropdownMenuItem
            key={String(form.id)}
            onClick={() => onInsertLink(url, form.name?.trim() || "Form")}
          >
            <FileText className="size-4" />
            <span className="truncate">{form.name?.trim() || form.slug}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
