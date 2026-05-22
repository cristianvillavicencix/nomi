import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { LbsDeal } from "@/lbs/types";
import { ConversationThread } from "@/lbs/messages/ConversationThread";
import { useEnsureProjectConversation } from "@/lbs/messages/useEnsureProjectConversation";

export const ProjectTeamChat = ({ record }: { record: LbsDeal }) => {
  const { dealStages } = useConfigurationContext();
  const projectTitle = record.name?.trim() || findDealLabel(dealStages, record.stage);
  const { conversation, isPending } = useEnsureProjectConversation(record.id, projectTitle);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Opening team chat…</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Team chat</h3>
        <p className="text-sm text-muted-foreground">
          Internal messages for this project. Only your CRM team can see this thread.
        </p>
      </div>
      <div className="h-[520px] p-3">
        <ConversationThread
          conversation={conversation}
          emptyLabel="No team messages yet. Use this space for quick project updates."
        />
      </div>
    </div>
  );
};
