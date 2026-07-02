import { useEffect, useMemo, useState } from "react";
import { useGetList, useGetOne } from "ra-core";
import { useFormContext } from "react-hook-form";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { getClientShowPath, getLeadShowPath } from "@/app/routing";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { getLeadStageDef } from "@/modules/leads/leadStages";
import { ProposalCrmLinkedMeta } from "@/modules/proposals/ProposalCrmLinkedMeta";
import {
  applyProposalCompanySelection,
  applyProposalContactSelection,
  clearProposalClientSelection,
  PROPOSAL_LEAD_SEARCH_FILTER,
  proposalClientSearchLabel,
  proposalClientSearchSubtitle,
} from "@/modules/proposals/proposalClientSearch";
import { useProposalCrmLinks } from "@/modules/proposals/useProposalCrmLinks";
import {
  buildCompanySearchMeta,
  buildContactSearchMeta,
  entitySearchPopoverClassName,
} from "@/modules/shared/referenceAutocompleteOptions";
import {
  EntitySearchGroup,
  EntitySearchOption,
  SelectedEntityRow,
} from "@/modules/shared/entityPickerUi";
import { isValidRecordId } from "@/lib/isValidRecordId";

export const ProposalCrmLinksCard = () => {
  const { watch, setValue, register } = useFormContext<{
    company_id: unknown;
    contact_id: unknown;
    deal_id: unknown;
  }>();

  useEffect(() => {
    register("company_id");
    register("contact_id");
    register("deal_id");
  }, [register]);

  const companyId = watch("company_id");
  const contactId = watch("contact_id");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { company, selectedDeal } = useProposalCrmLinks();

  const trimmedSearch = searchQuery.trim();
  const shouldFetch = searchOpen && trimmedSearch.length > 0;

  const { data: companies = [], isFetching: companiesFetching } =
    useGetList<Company>(
      "companies",
      {
        filter: trimmedSearch ? { q: trimmedSearch } : {},
        pagination: { page: 1, perPage: 12 },
        sort: { field: "name", order: "ASC" },
      },
      { enabled: shouldFetch },
    );

  const { data: leads = [], isFetching: leadsFetching } = useGetList<Contact>(
    "contacts",
    {
      filter: trimmedSearch
        ? { q: trimmedSearch, ...PROPOSAL_LEAD_SEARCH_FILTER }
        : PROPOSAL_LEAD_SEARCH_FILTER,
      pagination: { page: 1, perPage: 12 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: shouldFetch },
  );

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as Contact["id"] },
    { enabled: isValidRecordId(contactId) },
  );

  const hasSelection =
    isValidRecordId(companyId) || isValidRecordId(contactId);

  const profileHref = useMemo(() => {
    if (isValidRecordId(companyId)) return getClientShowPath(companyId);
    if (contact && isLeadLifecycleStatus(contact.status)) {
      return getLeadShowPath(contact.id);
    }
    return undefined;
  }, [companyId, contact]);

  const selectedTitle = proposalClientSearchLabel({ company, contact });
  const selectedSubtitle = proposalClientSearchSubtitle({
    company,
    contact,
    deal: selectedDeal,
  });

  const isFetching = companiesFetching || leadsFetching;

  const finishSelection = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client
          </p>
          {contact && isLeadLifecycleStatus(contact.status) ? (
            <Badge variant="outline" className="text-[10px]">
              {contact.lead_stage
                ? getLeadStageDef(contact.lead_stage).label
                : "Lead"}
            </Badge>
          ) : null}
        </div>

        {hasSelection ? (
          <SelectedEntityRow
            title={selectedTitle}
            subtitle={selectedSubtitle}
            profileHref={profileHref}
            onRemove={() => {
              clearProposalClientSelection(setValue);
              setSearchQuery("");
              setSearchOpen(true);
            }}
            removeAriaLabel="Clear client"
          />
        ) : (
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverAnchor asChild>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    if (!searchOpen) setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search client, lead, phone, or email…"
                  className="pl-9"
                  aria-expanded={searchOpen}
                  aria-autocomplete="list"
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              className={entitySearchPopoverClassName}
              align="start"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <Command shouldFilter={false}>
                <CommandList className="max-h-[min(18rem,50vh)]">
                  {isFetching ? (
                    <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Searching…
                    </div>
                  ) : !trimmedSearch ? (
                    <CommandEmpty>
                      Type a name, company, phone, or email.
                    </CommandEmpty>
                  ) : companies.length === 0 && leads.length === 0 ? (
                    <CommandEmpty>No clients or leads found.</CommandEmpty>
                  ) : (
                    <>
                      {companies.length > 0 ? (
                        <EntitySearchGroup heading="Clients">
                          {companies.map((row) => (
                            <EntitySearchOption
                              key={`company-${row.id}`}
                              label={row.name}
                              sublabel={
                                buildCompanySearchMeta(row) || undefined
                              }
                              selected={String(companyId) === String(row.id)}
                              onSelect={() => {
                                applyProposalCompanySelection(row, setValue);
                                finishSelection();
                              }}
                            />
                          ))}
                        </EntitySearchGroup>
                      ) : null}
                      {leads.length > 0 ? (
                        <EntitySearchGroup heading="Leads">
                          {leads.map((row) => {
                            const name = getContactFullName(row);
                            const stage = row.lead_stage
                              ? getLeadStageDef(row.lead_stage).label
                              : "Lead";
                            const meta = [
                              stage,
                              row.company_name?.trim(),
                              buildContactSearchMeta(row),
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            return (
                              <EntitySearchOption
                                key={`lead-${row.id}`}
                                label={
                                  name !== "—" ? name : `Lead #${row.id}`
                                }
                                sublabel={meta || undefined}
                                selected={
                                  String(contactId) === String(row.id)
                                }
                                onSelect={() => {
                                  applyProposalContactSelection(row, setValue);
                                  finishSelection();
                                }}
                              />
                            );
                          })}
                        </EntitySearchGroup>
                      ) : null}
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {hasSelection ? (
          <ProposalCrmLinkedMeta company={company} contact={contact} />
        ) : null}
      </CardContent>
    </Card>
  );
};
