import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router";
import { useGetIdentity } from "ra-core";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalDocumentView } from "@/lbs/proposals/document/ProposalDocumentView";
import { ProposalLanguageToggle } from "@/lbs/proposals/document/ProposalLanguageToggle";
import { ProposalLocaleProvider } from "@/lbs/proposals/document/ProposalLocaleContext";
import { parseProposalContent } from "@/lbs/proposals/document/proposalDocumentTypes";
import {
  buildCrmDocumentSnapshot,
  useProposalDocumentData,
} from "@/lbs/proposals/document/useProposalDocumentData";

const ProposalClientPreviewBody = () => {
  const { id } = useParams();
  const proposalId = id ?? "";

  const bundle = useProposalDocumentData(proposalId, {
    fetchLinkedContract: true,
    fetchContractTerms: true,
  });

  const documentData = useMemo(() => {
    if (!bundle.proposal) return null;
    return buildCrmDocumentSnapshot({
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
    });
  }, [bundle]);

  if (!proposalId) return null;

  if (bundle.isError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-8">
        <p className="max-w-md text-center text-sm text-destructive">
          {bundle.error instanceof Error
            ? bundle.error.message
            : "Could not load this proposal."}
        </p>
      </div>
    );
  }

  if (bundle.isLoading || !documentData) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-8">
        <Skeleton className="h-96 w-full max-w-3xl" />
      </div>
    );
  }

  const content = parseProposalContent(bundle.proposal.content);
  const contractSnapshot = bundle.linkedContract
    ? {
        signed_at: bundle.linkedContract.signed_at ?? null,
        deposit_paid_at: bundle.linkedContract.deposit_paid_at ?? null,
        terms_snapshot: bundle.linkedContract.terms_snapshot ?? null,
      }
    : null;

  return (
    <div className="min-h-svh bg-background">
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/40 print:hidden"
        role="note"
      >
        <p className="text-amber-950 dark:text-amber-100">
          <span className="font-semibold">Internal preview</span> — same layout
          and buttons the client sees. Toggle language below.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <ProposalLanguageToggle />
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 bg-white hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
            asChild
          >
            <Link to={`/proposals/${proposalId}/preview`}>
              <ArrowLeft className="size-4" />
              Back to editor
            </Link>
          </Button>
        </div>
      </div>

      <ProposalDocumentView
        proposalId={proposalId}
        content={content}
        documentData={documentData}
        editable={false}
        clientView
        pageScroll
        showAcceptPlaceholder
        acceptMode="preview"
        contractSnapshot={contractSnapshot}
      />
    </div>
  );
};

/**
 * Staff-only preview (CustomRoutes noLayout). Not the link sent to clients.
 */
export const ProposalClientPreviewRoute = () => {
  const { identity, isPending: isIdentityPending } = useGetIdentity();

  if (!isIdentityPending && !identity) {
    return <Navigate to="/login" replace />;
  }

  if (isIdentityPending) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-8">
        <Skeleton className="h-96 w-full max-w-3xl" />
      </div>
    );
  }

  return (
    <ProposalLocaleProvider>
      <ProposalClientPreviewBody />
    </ProposalLocaleProvider>
  );
};
