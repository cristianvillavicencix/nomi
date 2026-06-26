import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalLanguageToggle } from "@/modules/proposals/document/ProposalLanguageToggle";
import {
  getProposalDocumentCopy,
  PROPOSAL_LOCALE_KEY,
  type ProposalLocale,
} from "@/modules/proposals/document/proposalDocumentI18n";
import { ProposalLocaleProvider } from "@/modules/proposals/document/ProposalLocaleContext";
import { useProposalLocale } from "@/modules/proposals/document/ProposalLocaleContext";
import { PublicProposalAcceptPortal } from "@/modules/proposals/public/PublicProposalAcceptPortal";
import { fetchPublicProposal } from "@/modules/proposals/public/publicProposalApi";

const readStoredLocale = (): ProposalLocale => {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(PROPOSAL_LOCALE_KEY) === "es"
    ? "es"
    : "en";
};

export const PublicProposalAcceptPage = () => {
  const { token = "" } = useParams();
  const { locale } = useProposalLocale();
  const copy = getProposalDocumentCopy(locale);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["public-proposal-accept", token],
    queryFn: () => fetchPublicProposal(token),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {copy.invalidLink}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <Skeleton className="mx-auto h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-2 p-8 text-center text-sm text-muted-foreground">
        <p>{copy.expiredLink}</p>
        {error instanceof Error && error.message ? (
          <p className="text-xs text-destructive">{error.message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-10 flex items-center justify-end border-b bg-card/95 px-4 py-2 backdrop-blur">
        <ProposalLanguageToggle />
      </header>
      <PublicProposalAcceptPortal
        token={token}
        payload={data}
        locale={locale}
        mode="live"
        onRefresh={() => void refetch()}
      />
    </div>
  );
};

export const PublicProposalAcceptPageWithLocale = () => (
  <ProposalLocaleProvider defaultLocale={readStoredLocale()}>
    <PublicProposalAcceptPage />
  </ProposalLocaleProvider>
);
