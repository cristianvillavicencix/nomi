import type { ClientSocialLinkValue } from "@/lbs/clients/clientSocialLinks";
import {
  detectSocialNetworkFromUrl,
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
} from "@/lbs/clients/clientSocialLinks";
import { cn } from "@/lib/utils";

type ClientSocialLinksDisplayProps = {
  links: ClientSocialLinkValue[];
  iconClassName?: string;
  className?: string;
  stopPropagation?: boolean;
};

export const ClientSocialLinksDisplay = ({
  links,
  iconClassName = "size-4",
  className,
  stopPropagation = false,
}: ClientSocialLinksDisplayProps) => {
  if (links.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {links.map((link) => {
        const { Icon } = getSocialNetworkOption(
          link.network || detectSocialNetworkFromUrl(link.url),
        );
        const label = getSocialLinkLabel(link);

        return (
          <a
            key={`${link.url}-${link.network ?? detectSocialNetworkFromUrl(link.url)}`}
            href={normalizeSocialUrl(link.url)}
            target="_blank"
            rel="noreferrer"
            title={label}
            aria-label={label}
            className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
            onClick={
              stopPropagation ? (event) => event.stopPropagation() : undefined
            }
          >
            <Icon className={iconClassName} />
          </a>
        );
      })}
    </div>
  );
};
