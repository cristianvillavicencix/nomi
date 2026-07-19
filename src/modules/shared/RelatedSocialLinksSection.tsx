import { useMemo, type ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Contact } from "@/components/atomic-crm/types";
import {
  collectContactSocialLinks,
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
  type ClientSocialLinkValue,
} from "@/modules/clients/clientSocialLinks";
import {
  RelatedEmptyState,
  RelatedSection,
} from "@/modules/shared/RelatedSection";

const SocialIconLink = ({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <IconButton
        aria-label={label}
        asChild
        variant="secondary"
        className="size-9 shrink-0 rounded-full"
      >
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
        >
          {children}
        </a>
      </IconButton>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const RelatedSocialLinksSection = ({
  contact,
}: {
  contact: Contact;
}) => {
  const socialLinks = useMemo(
    () => collectContactSocialLinks(contact),
    [contact],
  );

  return (
    <RelatedSection
      title="Social links"
      count={socialLinks.length}
      empty={
        <RelatedEmptyState message="No social links added for this lead yet." />
      }
    >
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap items-center gap-2">
          {socialLinks.map((link: ClientSocialLinkValue) => {
            const { Icon } = getSocialNetworkOption(link.network);
            const label = getSocialLinkLabel(link);

            return (
              <SocialIconLink
                key={`${link.url}-${link.network ?? "other"}`}
                href={normalizeSocialUrl(link.url)}
                label={label}
              >
                <Icon className="size-4" />
              </SocialIconLink>
            );
          })}
        </div>
      </TooltipProvider>
    </RelatedSection>
  );
};
