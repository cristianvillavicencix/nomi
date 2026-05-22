import {
  FileText,
  FolderKanban,
  MessageSquare,
  Plus,
  Ticket,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router";
import { type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getClientDealCreatePath,
  getClientProposalCreatePath,
} from "@/lbs/routing";
import type { Contact } from "@/lbs/types";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import { useMessagesQuickAccess } from "@/lbs/messages/MessagesQuickAccessProvider";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";

type ClientNewMenuProps = {
  companyId: Identifier;
  primaryContactId?: Identifier | null;
  primaryContact?: Contact | null;
  onAddContact: () => void;
  align?: "start" | "end";
  size?: "sm" | "icon";
};

const TextClientMenuItem = ({ contact }: { contact: Contact }) => {
  const { smsEnabled } = useMessagingEnabled();
  const { openSms, isOpening } = useMessagesQuickAccess();

  if (!smsEnabled || !contactHasSmsPhone(contact)) {
    return null;
  }

  return (
    <DropdownMenuItem disabled={isOpening} onClick={() => void openSms(contact)}>
      <MessageSquare className="size-4" />
      Text client
    </DropdownMenuItem>
  );
};

export const ClientNewMenu = ({
  companyId,
  primaryContactId,
  primaryContact,
  onAddContact,
  align = "end",
  size = "sm",
}: ClientNewMenuProps) => {
  const ticketParams = new URLSearchParams({ company_id: String(companyId) });
  if (primaryContactId != null) {
    ticketParams.set("contact_id", String(primaryContactId));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {size === "icon" ? (
          <Button variant="outline" size="icon" className="size-9 shrink-0">
            <Plus className="size-4" />
            <span className="sr-only">Create new</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="shrink-0">
            <Plus className="size-4" />
            New
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {primaryContact ? <TextClientMenuItem contact={primaryContact} /> : null}
        <DropdownMenuItem onClick={onAddContact}>
          <UserPlus className="size-4" />
          Add contact
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={getClientDealCreatePath(companyId, primaryContactId)}>
            <FolderKanban className="size-4" />
            New project
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={getClientProposalCreatePath(companyId, primaryContactId)}>
            <FileText className="size-4" />
            New proposal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/tickets/create?${ticketParams.toString()}`}>
            <Ticket className="size-4" />
            New ticket
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
