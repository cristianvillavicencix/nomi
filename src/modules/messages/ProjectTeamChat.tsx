import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { LbsDeal } from "@/modules/types";
import { ConversationThread } from "@/modules/messages/ConversationThread";
import { useEnsureProjectConversation } from "@/modules/messages/useEnsureProjectConversation";
import { cn } from "@/lib/utils";

export const ProjectTeamChat = ({
  record,
  variant = "default",
  embedMode = false,
}: {
  record: LbsDeal;
  variant?: "default" | "sidebar";
  /** Flat layout for the project context side panel (no card chrome). */
  embedMode?: boolean;
}) => {
  const { dealStages } = useConfigurationContext();
  const projectTitle =
    record.name?.trim() || findDealLabel(dealStages, record.stage);
  const { conversation, isPending } = useEnsureProjectConversation(
    record.id,
    projectTitle,
  );

  if (isPending) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        Opening team chat…
      </p>
    );
  }

  if (embedMode) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="shrink-0 border-b px-3 py-2 text-[11px] text-muted-foreground">
          Internal team chat — clients cannot see these messages.
        </p>
        <div className="min-h-0 flex-1">
          <ConversationThread
            conversation={conversation}
            emptyLabel="No team messages yet."
          />
        </div>
      </div>
    );
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
