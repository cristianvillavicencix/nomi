import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Printer, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useGetIdentity } from "ra-core";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalDocumentView } from "@/modules/proposals/document/ProposalDocumentView";
import { buildCrmDocumentSnapshot } from "@/modules/proposals/document/useProposalDocumentData";
import { hydrateProposalContent } from "@/modules/proposals/document/proposalTemplateContent";
import { useProposalDocumentData } from "@/modules/proposals/document/useProposalDocumentData";
import {
  buildProposalVariableContext,
  mergeProposalDocumentContent,
} from "@/modules/proposals/document/proposalVariableMerge";
import { resolveProposalDocumentContent } from "@/modules/proposals/document/proposalLocalizedContent";
import { exportProposalPdf } from "@/modules/proposals/proposalPdfExport";
import { ProposalSendActions } from "@/modules/proposals/ProposalSendActions";
import { isValidRecordId } from "@/lib/isValidRecordId";

export const ProposalViewPage = () => {
  const { id } = useParams();
  const { identity, isPending: isIdentityLoading } = useGetIdentity();
  const queryClient = useQueryClient();

  const proposalId = isValidRecordId(id) ? id : "";
  const bundle = useProposalDocumentData(proposalId, {
    enabled: isValidRecordId(id) && Boolean(identity),
  });

  const content = useMemo(
    () =>
      bundle.proposal
        ? hydrateProposalContent(bundle.proposal.content)
        : undefined,
    [bundle.proposal?.content],
  );

  const documentData =
    bundle.proposal != null
      ? buildCrmDocumentSnapshot({
          proposal: bundle.proposal,
          lineDrafts: bundle.lineDrafts,
          lines: bundle.lines,
          paymentInstallments: bundle.paymentInstallments,
          oneTimeTotal: bundle.oneTimeTotal,
          currency: bundle.currency,
          company: bundle.company,
          contact: bundle.contact,
          deal: bundle.deal,
          member: bundle.member,
          contractTerms: bundle.contractTerms,
        })
      : undefined;

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!bundle.proposal || !documentData || !content) return;
    setIsExportingPdf(true);
    try {
      const variables = buildProposalVariableContext({
        proposal: bundle.proposal,
        company: bundle.company,
        contact: bundle.contact,
        deal: bundle.deal,
        member: bundle.member,
      });
      const merged = mergeProposalDocumentContent(content, variables);
      const localized = resolveProposalDocumentContent(merged, "en");
      await exportProposalPdf({
        proposal: bundle.proposal,
        content: localized,
        snapshot: documentData,
        locale: "en",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isValidRecordId(id)) return null;

  if (isIdentityLoading || !identity || bundle.isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (bundle.isError) {
    return (
      <p className="p-6 text-sm text-destructive">
        {bundle.error instanceof Error
          ? bundle.error.message
          : "Failed to load proposal."}
      </p>
    );
  }

  if (!bundle.proposal || !content) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Proposal not found.</p>
    );
  }

  return (
    <div className="flex h-[calc(100svh-var(--header-height,0px))] min-h-0 flex-col overflow-hidden">
      <div className="print:hidden shrink-0 flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/proposals">
            <ArrowLeft className="size-4" />
            Proposals
          </Link>
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4" />
            Print
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/proposals/${proposalId}/preview`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/proposals/${proposalId}/edit`}>
              <Wrench className="size-4" />
              Builder
            </Link>
          </Button>
          <ProposalSendActions
            proposal={bundle.proposal}
            lineItems={bundle.lines}
            installments={bundle.paymentInstallments}
            confirmExpiryBeforeSend
            showPdfExport={false}
            onSent={async () => {
              await queryClient.invalidateQueries({ queryKey: ["proposals"] });
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden print:block">
        <ProposalDocumentView
          proposalId={proposalId}
          content={content}
          documentData={documentData}
          editable={false}
          clientView
          showSectionNav
          onDownloadPdf={() => void handleDownloadPdf()}
          isExportingPdf={isExportingPdf}
        />
      </div>
    </div>
  );
};
