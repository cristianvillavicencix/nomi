import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { LbsDeal } from "@/lbs/types";
import { ConversationThread } from "@/lbs/messages/ConversationThread";
import { useEnsureProjectConversation } from "@/lbs/messages/useEnsureProjectConversation";
import { cn } from "@/lib/utils";

export const ProjectTeamChat = ({
  record,
  variant = "default",
}: {
  record: LbsDeal;
  variant?: "default" | "sidebar";
}) => {
  const { dealStages } = useConfigurationContext();
  const projectTitle =
    record.name?.trim() || findDealLabel(dealStages, record.stage);
  const { conversation, isPending } = useEnsureProjectConversation(
    record.id,
    projectTitle,
  );

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Opening team chat…</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Team chat</h3>
        <p className="text-sm text-muted-foreground">
          Internal messages for this project. Only your CRM team can see this
          thread.
        </p>
      </div>
      <div
        className={cn(
          "p-3",
          variant === "sidebar"
            ? "h-[min(520px,calc(100vh-16rem))]"
            : "h-[520px]",
        )}
      >
        <ConversationThread
          conversation={conversation}
          emptyLabel="No team messages yet. Use this space for quick project updates."
        />
      </div>
    </div>
  );
};
