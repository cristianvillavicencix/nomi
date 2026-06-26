import { ProjectTeamChat } from "@/modules/messages/ProjectTeamChat";
import { DealClientSmsButton } from "@/modules/deals/DealClientSmsButton";
import type { LbsDeal } from "@/modules/types";

export const ProjectMessagesTab = ({ record }: { record: LbsDeal }) => (
  <div className="space-y-6">
    <div className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Client SMS</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Send a text message to this project&apos;s contact. The client
            receives it on their phone from your CRM number.
          </p>
        </div>
        <DealClientSmsButton
          record={record}
          label="Message client"
          showLabel
        />
      </div>
      <div className="px-4 py-3 text-sm text-muted-foreground">
        Opens the SMS thread for the project contact in Messages. This is not the
        internal team chat below.
      </div>
    </div>

    <ProjectTeamChat record={record} />
  </div>
);
