import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useGetOne } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import type { Contact } from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";
import { collectContactSocialLinks } from "@/lbs/clients/clientSocialLinks";
import {
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
  type ClientSocialLinkValue,
} from "@/lbs/clients/clientSocialLinks";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
  formatDateTime,
} from "@/lbs/clients/clientShowUtils";
import { ContactQuickActions } from "@/lbs/contacts/ContactQuickActions";
import { getClientShowPath } from "@/lbs/routing";

type ContactSummaryCardProps = {
  record: Contact;
  hideCompanyLink?: boolean;
};

const ProfileSectionTitle = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    {children}
  </p>
);

const ProfileFadeText = ({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "h1";
}) => {
  const contentRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth + 1);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="relative min-w-0">
      <Tag
        ref={contentRef as never}
        className={cn("truncate pr-6", className)}
      >
        {children}
      </Tag>
      {isOverflowing ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card via-card/80 to-transparent"
        />
      ) : null}
    </div>
  );
};

const ProfileInfoRow = ({
  label,
  value,
  fade = true,
}: {
  label: string;
  value: ReactNode;
  fade?: boolean;
}) => (
  <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-center gap-x-3 border-b border-border/60 py-2.5 text-sm last:border-b-0">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <div className="min-w-0 font-medium">
      {fade ? (
        <ProfileFadeText className="font-medium">{value}</ProfileFadeText>
      ) : (
        value
      )}
    </div>
  </div>
);

const ProfileIconLink = ({
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
      <Button
        asChild
        type="button"
        variant="outline"
        size="icon"
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
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const ContactSummaryCard = (props: ContactSummaryCardProps) => {
  const { record, hideCompanyLink = false } = props;
  const fullName = getContactFullName(record);
  const socialLinks = useMemo(
    () => collectContactSocialLinks(record),
    [record],
  );

  const { data: company } = useGetOne(
    "companies",
    { id: record.company_id! },
    { enabled: record.company_id != null },
  );

  const companyName = record.company_name?.trim() || company?.name?.trim();

  return (
    <Card
      className={cn(
        "gap-0 py-0",
        hideCompanyLink && "border-0 shadow-none",
      )}
    >
      <CardContent className={hideCompanyLink ? "px-3 py-3" : "px-4 py-4"}>
        <div className="flex flex-col items-center text-center">
          <Avatar record={record} width={40} height={40} />

          <div className="relative mt-3 w-full min-w-0 px-1">
            <ProfileFadeText as="h1" className="text-lg font-semibold leading-tight">
              {fullName}
            </ProfileFadeText>
          </div>
        </div>

        <div className={hideCompanyLink ? "mt-3" : "mt-4"}>
          <ContactQuickActions
            contactId={record.id}
            contact={record}
            compact={hideCompanyLink}
          />
        </div>

        <div
          className={
            hideCompanyLink
              ? "mt-3 border-t border-border/60 pt-3"
              : "mt-4 border-t border-border/60 pt-3"
          }
        >
          <ProfileSectionTitle>Key information</ProfileSectionTitle>
          {!hideCompanyLink ? (
            <ProfileInfoRow
              label="Company"
              fade={!companyName}
              value={
                record.company_id && companyName ? (
                  <Link
                    to={getClientShowPath(record.company_id)}
                    className="link-action block truncate font-medium"
                  >
                    {companyName}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
          ) : null}
          <ProfileInfoRow label="Phone" value={getContactPhone(record)} />
          <ProfileInfoRow label="Email" value={getContactEmail(record)} />
          <ProfileInfoRow
            label="Address"
            value={record.address?.trim() || "—"}
          />
          <ProfileInfoRow
            label="Created"
            value={formatDateTime(record.first_seen)}
          />
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          <ProfileSectionTitle>Social links</ProfileSectionTitle>
          {socialLinks.length > 0 ? (
            <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap items-center gap-2">
                {socialLinks.map((link: ClientSocialLinkValue) => {
                  const { Icon } = getSocialNetworkOption(link.network);
                  const label = getSocialLinkLabel(link);

                  return (
                    <ProfileIconLink
                      key={`${link.url}-${link.network ?? "other"}`}
                      href={normalizeSocialUrl(link.url)}
                      label={label}
                    >
                      <Icon className="size-4" />
                    </ProfileIconLink>
                  );
                })}
              </div>
            </TooltipProvider>
          ) : (
            <p className="text-sm text-muted-foreground">No social links yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
