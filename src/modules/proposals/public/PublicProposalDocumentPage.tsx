import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalDocumentView } from "@/modules/proposals/document/ProposalDocumentView";
import { ProposalLanguageToggle } from "@/modules/proposals/document/ProposalLanguageToggle";
import { ProposalLocaleProvider } from "@/modules/proposals/document/ProposalLocaleContext";
import {
  getProposalDocumentCopy,
  PROPOSAL_LOCALE_KEY,
  type ProposalLocale,
} from "@/modules/proposals/document/proposalDocumentI18n";
import { mapPublicProposalDocumentData } from "@/modules/proposals/document/mapPublicProposalDocumentData";
import { hydrateProposalContent } from "@/modules/proposals/document/proposalTemplateContent";
import {
  fetchPublicProposal,
  type PublicProposalPayload,
} from "@/modules/proposals/public/publicProposalApi";
import {
  buildProposalVariableContext,
  mergeProposalDocumentContent,
} from "@/modules/proposals/document/proposalVariableMerge";
import { resolveProposalDocumentContent } from "@/modules/proposals/document/proposalLocalizedContent";
import { exportProposalPdf } from "@/modules/proposals/proposalPdfExport";
import { useProposalLocaleOptional } from "@/modules/proposals/document/ProposalLocaleContext";

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
  const content = useMemo(
    () => hydrateProposalContent(payload.proposal.content),
    [payload.proposal.content],
  );
  const publicDocumentData = mapPublicProposalDocumentData(payload);
  const localeContext = useProposalLocaleOptional();
  const locale = localeContext?.locale ?? readStoredLocale();
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const pdfContent = useMemo(() => {
    const variables = buildProposalVariableContext({
      proposal: publicDocumentData.proposal,
      company: publicDocumentData.company,
      contact: publicDocumentData.contact,
      deal: publicDocumentData.deal,
      member: publicDocumentData.member,
      organizationName: publicDocumentData.organization?.name,
    });
    const merged = mergeProposalDocumentContent(content, variables);
    return resolveProposalDocumentContent(merged, locale);
  }, [content, publicDocumentData, locale]);

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportProposalPdf({
        proposal: publicDocumentData.proposal,
        content: pdfContent,
        snapshot: publicDocumentData,
        locale,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="h-svh min-h-0 bg-background">
      <ProposalDocumentView
        proposalId={payload.proposal.id}
        content={content}
        editable={false}
        clientView
        showSectionNav
        showAcceptPlaceholder
        acceptMode="live"
        publicToken={token}
        onPublicRefresh={onRefresh}
        contractSnapshot={payload.contract}
        publicDocumentData={publicDocumentData}
        onDownloadPdf={() => void handleDownloadPdf()}
        isExportingPdf={isExportingPdf}
        sidebarLanguageToggle={
          <ProposalLanguageToggle className="w-full" />
        }
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
