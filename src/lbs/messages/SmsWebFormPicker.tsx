import { useMemo, useState } from "react";
import { useGetList, useDataProvider, type Identifier } from "ra-core";
import { useMutation } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/lbs/types";
import type { FormInstance } from "@/lbs/forms-v2/types";

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

export const SmsWebFormPicker = ({
  contact,
  dealId,
  onInsertLink,
  disabled,
  open,
  onOpenChange,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  onInsertLink: (url: string, label: string) => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [internalOpen, setInternalOpen] = useState(false);
  const menuOpen = open ?? internalOpen;
  const setMenuOpen = onOpenChange ?? setInternalOpen;

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
      setMenuOpen(false);
    },
  });

  const activeForms = useMemo(
    () => forms.filter((form) => form.is_active !== false),
    [forms],
  );

  if (activeForms.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={disabled || generateMutation.isPending}
          aria-label="Insert form link"
        >
          {generateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Insert form link</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {activeForms.map((form) => (
          <DropdownMenuItem
            key={String(form.id)}
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate(form)}
          >
            <FileText className="size-4" />
            <span className="truncate">{form.name?.trim() || form.slug}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
