import { useState } from "react";
import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Company } from "@/components/atomic-crm/types";

const optionalUrl = (url?: string) => {
  if (!url?.trim()) return;
  const urlRegex =
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?$/i;
  if (!urlRegex.test(url.trim())) {
    return "Must be a valid URL";
  }
};

const normalizeWebsite = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

/**
 * Company picker for the new-lead dialog: search existing companies or open a
 * compact inline panel to register name + website only.
 */
export const LeadCompanyField = () => {
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const [create] = useCreate();
  const { setValue } = useFormContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftWebsite, setDraftWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreatePanel = (prefillName?: string) => {
    setDraftName(prefillName?.trim() ?? "");
    setDraftWebsite("");
    setCreateOpen(true);
  };

  const handleCreateCompany = async () => {
    const name = draftName.trim();
    if (!name) {
      notify("Company name is required", { type: "warning" });
      return;
    }
    const website = normalizeWebsite(draftWebsite);
    const websiteError = optionalUrl(draftWebsite);
    if (websiteError) {
      notify(websiteError, { type: "warning" });
      return;
    }

    setSaving(true);
    try {
      const newCompany = (await create(
        "companies",
        {
          data: {
            name,
            website,
            organization_member_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      )) as Company;
      if (newCompany?.id != null) {
        setValue("company_id", newCompany.id, { shouldDirty: true });
      }
      setCreateOpen(false);
      setDraftName("");
      setDraftWebsite("");
      notify("Company created", { type: "info" });
    } catch {
      notify("Could not create company", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Company</Label>
        <Button
          type="button"
          variant="link"
          className="h-auto gap-1 p-0 text-xs text-muted-foreground"
          onClick={() => openCreatePanel()}
        >
          <Plus className="size-3.5" />
          New company
        </Button>
      </div>

      <ReferenceInput
        source="company_id"
        reference="companies"
        perPage={20}
        sort={{ field: "name", order: "ASC" }}
      >
        <AutocompleteInput
          optionText="name"
          helperText={false}
          modal={isMobile}
          onCreate={async (name?: string) => {
            openCreatePanel(name);
            return undefined;
          }}
          createItemLabel='Add "%{item}"'
          createLabel="Search or type a company name"
        />
      </ReferenceInput>

      {createOpen ? (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            New company — essentials only
          </p>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="lead-new-company-name" className="text-xs">
                Business name
              </Label>
              <input
                id="lead-new-company-name"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-new-company-website" className="text-xs">
                Website
              </Label>
              <input
                id="lead-new-company-website"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draftWebsite}
                onChange={(e) => setDraftWebsite(e.target.value)}
                placeholder="www.example.com"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleCreateCompany}
            >
              {saving ? "Saving…" : "Create company"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
