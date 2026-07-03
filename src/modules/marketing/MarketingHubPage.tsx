import { useMemo, useState } from "react";
import { Megaphone, Mail, MessageSquare, Plus } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageLayout,
  ScrollableContentArea,
} from "@/components/atomic-crm/layout/page-shell";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import { MarketingEmailCampaignDialog } from "@/modules/marketing/MarketingEmailCampaignDialog";
import { MarketingSmsCampaignDialog } from "@/modules/marketing/MarketingSmsCampaignDialog";
import { EmailCampaignsPanel } from "@/modules/marketing/EmailCampaignsPanel";
import { MarketingSetupBanner } from "@/modules/marketing/MarketingSetupBanner";
import { SmsCampaignsPanel } from "@/modules/marketing/SmsCampaignsPanel";
import {
  MARKETING_HUB_TAB_LABELS,
  type MarketingHubTab,
  resolveMarketingHubTab,
} from "@/modules/marketing/marketingHubTabs";

export const MarketingHubPage = () => {
  const { data: identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createSmsOpen, setCreateSmsOpen] = useState(false);
  const [createEmailOpen, setCreateEmailOpen] = useState(false);
  const activeTab = useMemo(
    () => resolveMarketingHubTab(searchParams),
    [searchParams],
  );

  const canManage = hasMemberCapability(identity, "marketing.campaigns.manage");
  const canSendCampaigns = hasMemberCapability(
    identity,
    "marketing.campaigns.send",
  );

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  if (!identity) return null;

  return (
    <PageLayout>
      <PageActions>
        <Megaphone className="size-4 shrink-0 text-muted-foreground" />
        <PageTitle label="Marketing" />
        <ModuleInfoPopover
          title="Marketing campaigns"
          description="Send promotional SMS and email blasts to opted-in contacts. Separate from the 1:1 Messages inbox and transactional invoice or ticket emails."
        />
        {canManage ? (
          <Button
            type="button"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() =>
              activeTab === "sms"
                ? setCreateSmsOpen(true)
                : setCreateEmailOpen(true)
            }
          >
            <Plus className="size-4" />
            New campaign
          </Button>
        ) : null}
      </PageActions>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="px-4 pt-2"
      >
        <TabsList>
          {(Object.keys(MARKETING_HUB_TAB_LABELS) as MarketingHubTab[]).map(
            (tab) => (
              <TabsTrigger key={tab} value={tab}>
                {MARKETING_HUB_TAB_LABELS[tab]}
              </TabsTrigger>
            ),
          )}
        </TabsList>
      </Tabs>

      <ScrollableContentArea className="space-y-6 p-4">
        {canManage ? <MarketingSetupBanner /> : null}

        {activeTab === "sms" ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="size-4" />
              <span>
                Bulk SMS to opted-in contacts. Does not use the Messages inbox.
                {canSendCampaigns ? "" : " You can view campaigns but need send permission to launch."}
              </span>
            </div>
            <SmsCampaignsPanel />
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4" />
              <span>
                Bulk email to newsletter opt-in contacts. System email (invoices, portal, etc.) is unchanged.
              </span>
            </div>
            <EmailCampaignsPanel />
          </section>
        )}
      </ScrollableContentArea>

      <MarketingSmsCampaignDialog
        open={createSmsOpen}
        onOpenChange={setCreateSmsOpen}
      />
      <MarketingEmailCampaignDialog
        open={createEmailOpen}
        onOpenChange={setCreateEmailOpen}
      />
    </PageLayout>
  );
};
