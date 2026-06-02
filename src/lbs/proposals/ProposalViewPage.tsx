import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Printer, Wrench } from "lucide-react";
import { Link, useParams } from "react-router";
import { useGetIdentity } from "ra-core";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalDocumentView } from "@/lbs/proposals/document/ProposalDocumentView";
import { parseProposalContent } from "@/lbs/proposals/document/proposalDocumentTypes";
import { useProposalDocumentData } from "@/lbs/proposals/document/useProposalDocumentData";
import { ProposalSendActions } from "@/lbs/proposals/ProposalSendActions";

export const ProposalViewPage = () => {
  const { id } = useParams();
  const { identity } = useGetIdentity();
  const queryClient = useQueryClient();

  if (!id || !identity) return null;

  const {
    proposal,
    isLoading,
    lines,
    paymentInstallments,
  } = useProposalDocumentData(id);

  const content = parseProposalContent(proposal?.content);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
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
            <Link to={`/proposals/${id}/preview`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/proposals/${id}/edit`}>
              <Wrench className="size-4" />
              Builder
            </Link>
          </Button>
          {proposal ? (
            <ProposalSendActions
              proposal={proposal}
              lineItems={lines}
              installments={paymentInstallments}
              confirmExpiryBeforeSend
              showPdfExport={false}
              onSent={async () => {
                await queryClient.invalidateQueries({ queryKey: ["proposals"] });
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden print:block">
        <ProposalDocumentView
          proposalId={id}
          content={content}
          editable={false}
          clientView
        />
      </div>
    </div>
  );
};
