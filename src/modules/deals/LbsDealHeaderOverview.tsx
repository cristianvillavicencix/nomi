import { Fragment, type ReactNode, useMemo } from "react";
import { useGetOne } from "ra-core";
import { Github, User } from "lucide-react";
import { Link } from "react-router";
import type { Contact } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";
import { getGithubRepoLabel, getGithubRepoUrl } from "@/modules/deals/githubRepo";
import { ProjectPortalLinkButton } from "@/modules/portal/ProjectPortalLinkButton";
import { getClientShowPath } from "@/app/routing";
import type { LbsDeal } from "@/modules/types";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

const MetaSeparator = () => (
  <span className="shrink-0 text-muted-foreground/40" aria-hidden>
    ·
  </span>
);

const MetaLine = ({
  items,
}: {
  items: { key: string; node: ReactNode | null }[];
}) => {
  const visible = items.filter((item) => item.node != null);
  if (visible.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
      {visible.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 ? <MetaSeparator /> : null}
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            {item.node}
          </span>
        </Fragment>
      ))}
    </div>
  );
};

export const LbsDealHeaderOverview = ({ record }: { record: LbsDeal }) => {
  const mainContactId = useMemo(() => {
    if (record.contact_id != null) return Number(record.contact_id);
    if (Array.isArray(record.contact_ids) && record.contact_ids.length > 0) {
      return Number(record.contact_ids[0]);
    }
    return null;
  }, [record.contact_id, record.contact_ids]);

  const { data: mainContact } = useGetOne<Contact>(
    "contacts_summary",
    { id: mainContactId as number },
    { enabled: mainContactId != null },
  );

  const contactName = mainContact ? getContactFullName(mainContact) : null;
  const contactEmail = mainContact ? getContactEmail(mainContact) : null;
  const rawPhone = mainContact ? getContactPhone(mainContact) : null;
  const contactPhone = rawPhone
    ? formatUsPhoneDisplayFromAny(rawPhone)
    : null;
  const companyName =
    record.company_name ??
    (record.company_id ? `Company #${record.company_id}` : null);
  const githubUrl = getGithubRepoUrl(record.github_repo);
  const githubLabel = getGithubRepoLabel(record.github_repo);

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-2xl font-bold tracking-tight">
          {record.name}
        </h1>
        <ProjectPortalLinkButton record={record} />
        {githubUrl ? (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={githubLabel ?? "Open GitHub repository"}
            aria-label={
              githubLabel
                ? `Open GitHub repository ${githubLabel}`
                : "Open GitHub repository"
            }
            className="inline-flex shrink-0 items-center rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="size-4" />
          </a>
        ) : null}
      </div>

      <MetaLine
        items={[
          {
            key: "company",
            node:
              record.company_id && companyName ? (
                <Link
                  to={getClientShowPath(record.company_id)}
                  className="link-action truncate"
                >
                  {companyName}
                </Link>
              ) : null,
          },
          {
            key: "contact",
            node:
              mainContactId != null && contactName ? (
                <>
                  <User className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  <Link
                    to={`/contacts/${mainContactId}/show`}
                    className="link-action truncate"
                  >
                    {contactName}
                  </Link>
                </>
              ) : null,
          },
          {
            key: "email",
            node: contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="link-action truncate">
                {contactEmail}
              </a>
            ) : null,
          },
          {
            key: "phone",
            node: contactPhone ? (
              <a
                href={`tel:${rawPhone?.replace(/[^\d+]/g, "")}`}
                className="link-action truncate"
              >
                {contactPhone}
              </a>
            ) : null,
          },
        ]}
      />
    </div>
  );
};
