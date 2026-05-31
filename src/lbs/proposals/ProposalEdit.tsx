import { useParams } from "react-router";
import { ProposalBuilderForm } from "@/lbs/proposals/ProposalBuilderForm";
import { ProposalPageShell } from "@/lbs/proposals/ProposalPageShell";

export const ProposalEdit = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ProposalPageShell title="Edit proposal" backTo={`/proposals/${id}/show`}>
      <div className="max-w-6xl">
        <ProposalBuilderForm proposalId={id} />
      </div>
    </ProposalPageShell>
  );
};
