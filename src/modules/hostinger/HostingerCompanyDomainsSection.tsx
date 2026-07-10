import { useMemo, useState } from "react";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import { Link } from "react-router";

import { getHostingerPath } from "@/app/routing";
import { AsideSection } from "@/components/atomic-crm/misc/AsideSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HostingerDomainDetailSheet } from "@/modules/hostinger/HostingerDomainDetailSheet";
import { HostingerDnsHealthBadges } from "@/modules/hostinger/HostingerDnsHealthBadges";
import {
  formatExpiryLabel,
  formatHostingerStatus,
} from "@/modules/hostinger/hostingerDomainUtils";
import { readDomainDnsHealth } from "@/modules/hostinger/hostingerDnsHealth";
import { getHostingerDomainManageUrl } from "@/modules/hostinger/hostingerHpanelLinks";
import { useHostingerCompanyDomains } from "@/modules/hostinger/useHostingerDomains";
import type { HostingerDomain } from "@/modules/hostinger/types";

type Props = {
  companyId: number;
};

const DomainListItem = ({
  domain,
  onOpen,
}: {
  domain: HostingerDomain;
  onOpen: (domain: HostingerDomain) => void;
}) => {
  const dnsHealth = readDomainDnsHealth(domain);

  return (
    <div className="rounded-md border px-3 py-2">
      <button
        type="button"
        onClick={() => onOpen(domain)}
        className="w-full text-left font-medium hover:underline"
      >
        {domain.domain}
      </button>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-normal text-[10px]">
          {formatHostingerStatus(domain.status)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatExpiryLabel(domain.expires_at)}
        </span>
      </div>
      <div className="mt-1.5">
        <HostingerDnsHealthBadges health={dnsHealth} compact />
      </div>
      <div className="mt-2">
        <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
          <a
            href={getHostingerDomainManageUrl(domain.domain)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            hPanel
            <ExternalLink className="ml-1 size-3" />
          </a>
        </Button>
      </div>
    </div>
  );
};

export const HostingerCompanyDomainsSection = ({ companyId }: Props) => {
  const domainsQuery = useHostingerCompanyDomains(companyId);
  const [selectedDomain, setSelectedDomain] = useState<HostingerDomain | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const domains = useMemo(() => domainsQuery.data ?? [], [domainsQuery.data]);

  if (domainsQuery.isLoading) {
    return (
      <AsideSection title="Hostinger domains">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading domains…</span>
        </div>
      </AsideSection>
    );
  }

  if (domainsQuery.isError || domains.length === 0) {
    return null;
  }

  const openDomainDetails = (domain: HostingerDomain) => {
    setSelectedDomain(domain);
    setDetailOpen(true);
  };

  return (
    <>
      <AsideSection title="Hostinger domains">
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <Globe className="size-4 shrink-0" />
          <span>
            {domains.length} domain{domains.length === 1 ? "" : "s"} linked via
            website hostname
          </span>
        </div>
        <div className="space-y-2">
          {domains.map((domain) => (
            <DomainListItem
              key={domain.id}
              domain={domain}
              onOpen={openDomainDetails}
            />
          ))}
        </div>
        <Button variant="link" size="sm" className="h-auto px-0" asChild>
          <Link to={getHostingerPath()}>Open Hostinger hub</Link>
        </Button>
      </AsideSection>

      <HostingerDomainDetailSheet
        domain={selectedDomain}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
};
