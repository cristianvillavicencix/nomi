import type { Identifier } from "ra-core";
import type { MouseEvent, ReactNode } from "react";
import { mailtoHref } from "@/lib/linking";
import { cn } from "@/lib/utils";
import { useMailComposeOptional } from "./mailComposeContext";
import { useMailComposeAvailable } from "./useMailComposeAvailable";

type OpenMailComposeLinkProps = {
  to: string | null | undefined;
  contactId?: Identifier;
  companyId?: Identifier;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
};

export const OpenMailComposeLink = ({
  to,
  contactId,
  companyId,
  className,
  onClick,
  children,
}: OpenMailComposeLinkProps) => {
  const email = (to ?? "").trim();
  const { canCompose } = useMailComposeAvailable();
  const mailCompose = useMailComposeOptional();

  if (!email) {
    return <span className={className}>—</span>;
  }

  if (canCompose && mailCompose) {
    return (
      <button
        type="button"
        className={cn("link-action", className)}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          mailCompose.openCompose({
            mode: "new",
            initialTo: email,
            contactId,
            companyId,
          });
        }}
      >
        {children}
      </button>
    );
  }

  const href = mailtoHref(email);
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      className={cn("link-action", className)}
      onClick={onClick}
    >
      {children}
    </a>
  );
};
