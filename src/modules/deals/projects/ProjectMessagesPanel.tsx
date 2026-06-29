import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LbsDeal } from "@/modules/types";
import { ProjectClientSmsPanel } from "@/modules/deals/projects/ProjectClientSmsPanel";
import { ProjectTeamChat } from "@/modules/messages/ProjectTeamChat";

type MessageChannel = "team" | "client";

const MESSAGE_CHANNELS: Array<{
  id: MessageChannel;
  label: string;
  description: string;
}> = [
  {
    id: "team",
    label: "Team",
    description: "Internal project chat",
  },
  {
    id: "client",
    label: "Client",
    description: "Text the project owner",
  },
];

export const ProjectMessagesPanel = ({
  record,
  className,
}: {
  record: LbsDeal;
  className?: string;
}) => {
  const [channel, setChannel] = useState<MessageChannel>("team");

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <div className="shrink-0 border-b px-2 py-2">
        <div
          className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5"
          role="tablist"
          aria-label="Message channel"
        >
          {MESSAGE_CHANNELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={channel === item.id}
              onClick={() => setChannel(item.id)}
              className={cn(
                "min-w-0 flex-1 rounded-md px-2 py-1.5 text-center transition-colors",
                channel === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block text-xs font-medium">{item.label}</span>
              <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {channel === "team" ? (
          <ProjectTeamChat record={record} variant="sidebar" embedMode />
        ) : (
          <ProjectClientSmsPanel record={record} className="min-h-0 flex-1" />
        )}
      </div>
    </div>
  );
};
