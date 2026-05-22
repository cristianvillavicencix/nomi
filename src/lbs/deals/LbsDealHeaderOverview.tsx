import type { ReactNode } from "react";
import { useMemo } from "react";
import { useGetOne } from "ra-core";
import { Github } from "lucide-react";
import { Link } from "react-router";
import type { Contact, Deal } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
} from "@/lbs/clients/clientShowUtils";
import { getGithubRepoLabel, getGithubRepoUrl } from "@/lbs/deals/githubRepo";

const CompactLine = ({
  left,
  right,
  leftClassName,
  rightClassName,
}: {
  left: ReactNode;
  right: ReactNode;
  leftClassName?: string;
  rightClassName?: string;
}) => (
  <div className="flex min-w-0 items-center gap-2">
    <span className={`min-w-0 truncate ${leftClassName ?? ""}`}>{left}</span>
    <span className="shrink-0 text-muted-foreground/50">|</span>
    <span className={`min-w-0 truncate ${rightClassName ?? ""}`}>{right}</span>
  </div>
);

export const LbsDealHeaderOverview = ({ record }: { record: Deal }) => {
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
  const contactPhone = mainContact ? getContactPhone(mainContact) : null;
  const companyName =
    record.company_name ?? (record.company_id ? `Company #${record.company_id}` : null);
  const githubUrl = getGithubRepoUrl(record.github_repo);
  const githubLabel = getGithubRepoLabel(record.github_repo);

  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-2xl font-semibold">{record.name}</span>
        {githubUrl ? (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={githubLabel ?? "Open GitHub repository"}
            aria-label={
              githubLabel ? `Open GitHub repository ${githubLabel}` : "Open GitHub repository"
            }
            className="inline-flex shrink-0 items-center rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="size-4" />
          </a>
        ) : null}
      </div>

      <CompactLine
        leftClassName="text-sm text-muted-foreground"
        rightClassName="text-sm text-muted-foreground"
        left={
          record.company_id && companyName ? (
            <Link to={`/clients/${record.company_id}/show`} className="link-action">
              {companyName}
            </Link>
          ) : (
            "—"
          )
        }
        right={
          mainContactId != null && contactName ? (
            <Link to={`/contacts/${mainContactId}/show`} className="link-action">
              {contactName}
            </Link>
          ) : (
            "—"
          )
        }
      />

      <CompactLine
        leftClassName="text-sm text-muted-foreground"
        rightClassName="text-sm text-muted-foreground"
        left={
          contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="link-action">
              {contactEmail}
            </a>
          ) : (
            "—"
          )
        }
        right={
          contactPhone ? (
            <a href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`} className="link-action">
              {contactPhone}
            </a>
          ) : (
            "—"
          )
        }
      />
    </div>
  );
};
