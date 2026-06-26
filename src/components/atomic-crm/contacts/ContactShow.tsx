import { FolderKanban } from "lucide-react";
import { useState } from "react";
import {
  RecordRepresentation,
  ShowBase,
  useGetList,
  useShowContext,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  ScrollableContentArea,
  StickyTabsBar,
} from "@/components/atomic-crm/layout/page-shell";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { MobileBackButton } from "../misc/MobileBackButton";
import { RelativeDate } from "../misc/RelativeDate";
import type { Contact, Deal } from "../types";
import { ContactFormDialog } from "@/modules/contacts/ContactFormDialog";
import { getNewDealManualCreatePath } from "@/modules/deals/projectCreatePaths";
import { ContactHeader } from "./ContactHeader";
import { getPersonListPath } from "@/app/routing";
import { ReferralsTab } from "@/modules/leads/ReferralsTab";
import { ContactActivityFeed } from "@/modules/shared/ContactActivityFeed";

const CONTACT_TABS = ["activities", "projects", "referrals"] as const;
type ContactTab = (typeof CONTACT_TABS)[number];

export const ContactShow = () => {
  const isMobile = useIsMobile();

  return (
    <ShowBase
      queryOptions={{
        onError: isMobile
          ? () => {
              /** disable mobile error notification as content handles empty states */
            }
          : undefined,
      }}
    >
      {isMobile ? <ContactShowContentMobile /> : <ContactShowContent />}
    </ShowBase>
  );
};

const ContactShowContentMobile = () => {
  const { record, isPending } = useShowContext<Contact>();
  const [editOpen, setEditOpen] = useState(false);
  const location = useLocation();

  if (isPending || !record) return null;

  return (
    <>
      <ContactFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />
      <MobileHeader>
        <MobileBackButton />
        <div className="flex flex-1 min-w-0">
          <Link
            to={getPersonListPath(record.status)}
            className="flex-1 min-w-0"
          >
            <h1 className="truncate text-xl font-semibold">
              <RecordRepresentation />
            </h1>
          </Link>
        </div>
      </MobileHeader>
      <MobileContent>
        <ContactHeader
          record={record}
          locationSearch={location.search}
          onEdit={() => setEditOpen(true)}
          isMobile
        />
        <Card>
          <CardContent>
            <ContactMainTabs record={record} />
          </CardContent>
        </Card>
      </MobileContent>
    </>
  );
};

export const ContactShowContent = ({
  embedded = false,
  onClose,
}: {
  embedded?: boolean;
  onClose?: () => void;
} = {}) => {
  const { record, isPending } = useShowContext<Contact>();
  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);

  if (isPending || !record) return null;

  return (
    <div className={embedded ? "mb-0" : "mt-2 mb-2"}>
      <ContactFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />
      <div className="space-y-4">
        <ContactHeader
          record={record}
          locationSearch={location.search}
          onEdit={() => setEditOpen(true)}
          embedded={embedded}
          onClose={onClose}
        />
        <Card>
          <CardContent>
            <ContactMainTabs record={record} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ContactMainTabs = ({ record }: { record: Contact }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = getValidTab(searchParams.get("tab"));
  const { total: projectsCount } = useGetList<Deal>(
    "deals",
    {
      filter: { "contact_ids@cs": `{${record.id}}` },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { total: referralsCount = 0 } = useGetList<Contact>(
    "contacts",
    {
      filter: { "referred_by_contact_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const handleTabChange = (tab: string) => {
    const nextTab = getValidTab(tab);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("tab", nextTab);
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <Tabs
      value={currentTab}
      onValueChange={handleTabChange}
      className="flex min-h-0 w-full flex-col"
    >
      <StickyTabsBar className="pb-2">
        <TabsList className="grid h-10 w-full grid-cols-3">
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="projects">
            Projects
            {typeof projectsCount === "number" ? ` (${projectsCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="referrals">
            Referrals
            {referralsCount > 0 ? ` (${referralsCount})` : ""}
          </TabsTrigger>
        </TabsList>
      </StickyTabsBar>

      <ScrollableContentArea>
        <TabsContent value="activities" className="pt-2">
          <ContactActivitiesTab record={record} />
        </TabsContent>

        <TabsContent value="projects" className="pt-2">
          <ContactProjectsTab record={record} />
        </TabsContent>

        <TabsContent value="referrals" className="pt-2">
          <ReferralsTab referrerContactId={record.id} />
        </TabsContent>
      </ScrollableContentArea>
    </Tabs>
  );
};

const ContactActivitiesTab = ({ record }: { record: Contact }) => (
  <ContactActivityFeed contact={record} />
);

const ContactProjectsTab = ({ record }: { record: Contact }) => {
  const {
    data: deals,
    isPending,
    error,
  } = useGetList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${record.id}}` },
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage: 50 },
  });
  const companyIds = useMemo(
    () => Array.from(new Set((deals ?? []).map((deal) => deal.company_id))),
    [deals],
  );
  const { data: companies } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companiesById = useMemo(
    () =>
      Object.fromEntries(
        (companies ?? []).map((company) => [company.id, company]),
      ),
    [companies],
  );

  if (isPending) {
    return <TabEmptyState label="Loading projects..." />;
  }

  if (error || !deals?.length) {
    return (
      <div className="space-y-4">
        <ProjectsTabHeader />
        <TabEmptyState label="No projects linked to this contact yet." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProjectsTabHeader />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Project Name</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Start Date</th>
              <th className="px-4 py-3 text-left font-medium">Value</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr
                key={deal.id}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/deals/${deal.id}/show`}
                    className="link-action font-medium"
                  >
                    {deal.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {deal.stage}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {deal.created_at
                    ? new Date(deal.created_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3">{formatCurrency(deal.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {companiesById[deal.company_id]?.name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProjectsTabHeader = () => {
  const { record } = useShowContext<Contact>();
  const createHref = record
    ? getNewDealManualCreatePath(record.company_id, record.id)
    : getNewDealManualCreatePath();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold">Projects</h3>
        <p className="text-sm text-muted-foreground">
          Projects linked to this contact.
        </p>
      </div>
      <Button asChild>
        <Link to={createHref}>
          <FolderKanban className="size-4" />
          Create Project
        </Link>
      </Button>
    </div>
  );
};

const TabEmptyState = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
    {label}
  </div>
);

const getValidTab = (value: string | null): ContactTab => {
  if (value != null && (CONTACT_TABS as readonly string[]).includes(value)) {
    return value as ContactTab;
  }
  return "activities";
};
