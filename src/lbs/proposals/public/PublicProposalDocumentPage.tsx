import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalDocumentView } from "@/lbs/proposals/document/ProposalDocumentView";
import { ProposalLanguageToggle } from "@/lbs/proposals/document/ProposalLanguageToggle";
import { ProposalLocaleProvider } from "@/lbs/proposals/document/ProposalLocaleContext";
import {
  getProposalDocumentCopy,
  PROPOSAL_LOCALE_KEY,
  type ProposalLocale,
} from "@/lbs/proposals/document/proposalDocumentI18n";
import { mapPublicProposalDocumentData } from "@/lbs/proposals/document/mapPublicProposalDocumentData";
import { parseProposalContent } from "@/lbs/proposals/document/proposalDocumentTypes";
import {
  fetchPublicProposal,
  type PublicProposalPayload,
} from "@/lbs/proposals/public/publicProposalApi";

const readStoredLocale = (): ProposalLocale => {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(PROPOSAL_LOCALE_KEY) === "es" ? "es" : "en";
};

const PublicProposalDocumentBody = ({
  token,
  payload,
  onRefresh,
}: {
  token: string;
  payload: PublicProposalPayload;
  onRefresh: () => void;
}) => {
  const content = parseProposalContent(payload.proposal.content);
  const publicDocumentData = mapPublicProposalDocumentData(payload);

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-end border-b bg-card/95 px-4 py-2 backdrop-blur">
        <ProposalLanguageToggle />
      </header>
      <ProposalDocumentView
        proposalId={payload.proposal.id}
        content={content}
        editable={false}
        clientView
        pageScroll
        showAcceptPlaceholder
        acceptMode="live"
        publicToken={token}
        onPublicRefresh={onRefresh}
        contractSnapshot={payload.contract}
        publicDocumentData={publicDocumentData}
      />
    </div>
  );
};

const PublicProposalDocumentPage = () => {
  const { token = "" } = useParams();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => fetchPublicProposal(token),
    enabled: !!token,
  });

  const copy = getProposalDocumentCopy(readStoredLocale());

  if (!token) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {copy.invalidLink}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="mx-auto h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
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
    <PublicProposalDocumentBody
      token={token}
      payload={data}
      onRefresh={() => void refetch()}
    />
  );
};

export const PublicProposalPage = () => (
  <ProposalLocaleProvider defaultLocale={readStoredLocale()}>
    <PublicProposalDocumentPage />
  </ProposalLocaleProvider>
);
