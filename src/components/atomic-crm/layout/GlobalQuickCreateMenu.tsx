import { useMemo, useState } from "react";
import { useGetIdentity } from "ra-core";
import { useNavigate } from "react-router";
import {
  Building2,
  CalendarClock,
  MessageSquare,
  Plus,
  UserPlus,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import {
  hasMemberCapability,
  resolveEffectiveModules,
} from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import { getClientCreatePath, getContactCreatePath } from "@/app/routing";
import { getNewDealManualCreatePath } from "@/modules/deals/projectCreatePaths";
import { BookNowShareDialog } from "@/modules/booking/BookNowShareDialog";

export const GlobalQuickCreateMenu = () => {
  const navigate = useNavigate();
  const { identity } = useGetIdentity();
  const [bookNowOpen, setBookNowOpen] = useState(false);

  const actions = useMemo(() => {
    if (!identity || typeof identity !== "object") return [];

    const modules = resolveEffectiveModules(identity);
    const items: Array<{
      id: string;
      label: string;
      icon: typeof Plus;
      onSelect: () => void;
      section: "create" | "share";
    }> = [];

    if (canAccess(identity, { resource: "contacts", action: "create" })) {
      items.push({
        id: "contact",
        label: "New contact",
        icon: UserPlus,
        section: "create",
        onSelect: () => navigate(getContactCreatePath()),
      });
    }

    if (canAccess(identity, { resource: "companies", action: "create" })) {
      items.push({
        id: "company",
        label: "New company",
        icon: Building2,
        section: "create",
        onSelect: () => navigate(getClientCreatePath()),
      });
    }

    if (canAccess(identity, { resource: "deals", action: "create" })) {
      items.push({
        id: "deal",
        label: "New deal",
        icon: Briefcase,
        section: "create",
        onSelect: () => navigate(getNewDealManualCreatePath()),
      });
    }

    if (modules.messaging && hasMemberCapability(identity, "messaging.send")) {
      items.push({
        id: "message",
        label: "New message",
        icon: MessageSquare,
        section: "share",
        onSelect: () => navigate("/messages"),
      });

      items.push({
        id: "book-now",
        label: "Book now",
        icon: CalendarClock,
        section: "share",
        onSelect: () => setBookNowOpen(true),
      });
    }

    return items;
  }, [identity, navigate]);

  if (actions.length === 0) return null;

  const createActions = actions.filter((item) => item.section === "create");
  const shareActions = actions.filter((item) => item.section === "share");

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Quick create"
              >
                <Plus className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Quick create</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          {createActions.length > 0 ? (
            <>
              <DropdownMenuLabel>Create</DropdownMenuLabel>
              {createActions.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={item.onSelect}
                  className="gap-2"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {createActions.length > 0 && shareActions.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {shareActions.length > 0 ? (
            <>
              <DropdownMenuLabel>Share</DropdownMenuLabel>
              {shareActions.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={item.onSelect}
                  className="gap-2"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <BookNowShareDialog open={bookNowOpen} onOpenChange={setBookNowOpen} />
    </>
  );
};
