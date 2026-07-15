import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { TicketDetailPanel } from "@/modules/tickets/TicketDetailPanel";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";

export const TicketOverviewPreview = ({
  ticketId,
  onClose,
}: {
  ticketId: string;
  onClose: () => void;
}) => (
  <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">Preview</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
          <Link to={ticketShowPath(ticketId)}>
            <ExternalLink className="size-3.5" />
            Full view
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">
      <TicketDetailPanel
        key={ticketId}
        ticketId={ticketId}
        layout="inbox-split"
      />
    </div>
  </div>
);
