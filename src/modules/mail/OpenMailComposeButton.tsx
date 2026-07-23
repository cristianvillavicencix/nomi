import type { Identifier } from "ra-core";
import type { ReactNode } from "react";
import { mailtoHref } from "@/lib/linking";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMailComposeOptional } from "./mailComposeContext";
import { useMailComposeAvailable } from "./useMailComposeAvailable";

type OpenMailComposeButtonProps = {
  to: string | null | undefined;
  contactId?: Identifier;
  companyId?: Identifier;
  label?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export const OpenMailComposeButton = ({
  to,
  contactId,
  companyId,
  label = "Email",
  disabled,
  className,
  children,
}: OpenMailComposeButtonProps) => {
  const email = (to ?? "").trim();
  const { canCompose, isPending } = useMailComposeAvailable();
  const mailCompose = useMailComposeOptional();

  const isDisabled = disabled || !email || isPending;
  const fallbackHref =
    !canCompose && email ? mailtoHref(email) : undefined;

  const button = fallbackHref ? (
    <IconButton
      aria-label={label}
      asChild
      variant="secondary"
      className={cn("size-10 shrink-0 rounded-full", className)}
      disabled={isDisabled}
    >
      <a href={fallbackHref} aria-label={label}>
        {children}
      </a>
    </IconButton>
  ) : (
    <IconButton
      variant="secondary"
      className={cn("size-10 shrink-0 rounded-full", className)}
      disabled={isDisabled}
      aria-label={label}
      onClick={() => {
        mailCompose?.openCompose({
          mode: "new",
          initialTo: email,
          contactId,
          companyId,
        });
      }}
    >
      {children}
    </IconButton>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
