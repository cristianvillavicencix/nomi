import { Link } from "react-router";
import { ArrowLeft, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";

export const TicketEmptyDetailState = ({
  showBack = false,
  onBack,
}: {
  showBack?: boolean;
  onBack?: () => void;
}) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-12 text-center">
    {showBack && onBack ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute left-3 top-3 lg:hidden"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 size-4" />
        Tickets
      </Button>
    ) : null}
    <div className="flex size-14 items-center justify-center rounded-full bg-muted/60">
      <Inbox className="size-7 text-muted-foreground" />
    </div>
    <div className="max-w-sm space-y-1">
      <p className="text-base font-medium text-foreground">Select a ticket</p>
      <p className="text-sm text-muted-foreground">
        Choose a conversation from the inbox to read the thread and reply from{" "}
        <Link
          to="/settings"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {DEFAULT_TICKET_INBOX_EMAIL}
        </Link>
        .
      </p>
    </div>
  </div>
);
