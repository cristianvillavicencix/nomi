import { FileText } from "lucide-react";
import type { Contact } from "@/components/atomic-crm/types";
import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { RelativeDate } from "@/components/atomic-crm/misc/RelativeDate";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { getLeadBackgroundText } from "@/modules/leads/leadBackgroundUtils";

export const LeadBackgroundNote = ({ lead }: { lead: Contact }) => {
  const text = getLeadBackgroundText(lead);
  if (!text) return null;

  const noteDate = lead.first_seen ?? lead.created_at ?? null;

  return (
    <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-3">
        <Avatar record={lead} width={20} height={20} />
        <div className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">Lead background</span>
        </div>
        {noteDate ? (
          <span className="shrink-0 text-sm text-muted-foreground">
            <RelativeDate date={noteDate} />
          </span>
        ) : null}
      </div>
      <div className="pt-2 text-sm max-w-150">
        <Markdown className="[&_p]:leading-5 [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline [&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside">
          {text}
        </Markdown>
      </div>
    </div>
  );
};
