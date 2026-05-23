import { Mail } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mailtoHref } from "@/lib/linking";
import type { ClientEmailEntry } from "@/lbs/clients/clientProfile";

type ClientExtraEmailsIndicatorProps = {
  extraEmails: ClientEmailEntry[];
};

export const ClientExtraEmailsIndicator = ({
  extraEmails,
}: ClientExtraEmailsIndicatorProps) => {
  if (extraEmails.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          aria-label={`${extraEmails.length} more email${extraEmails.length === 1 ? "" : "s"}`}
        >
          <Mail className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs space-y-1.5">
        {extraEmails.map((entry) => (
          <div key={`${entry.label}-${entry.email}`} className="text-left">
            <div className="text-[10px] uppercase tracking-wide opacity-80">
              {entry.label}
            </div>
            <a
              href={mailtoHref(entry.email)}
              className="break-all underline-offset-2 hover:underline"
            >
              {entry.email}
            </a>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
};
