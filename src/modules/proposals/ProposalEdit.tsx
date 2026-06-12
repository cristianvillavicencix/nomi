import { useParams } from "react-router";
import { ProposalBuilderForm } from "@/modules/proposals/ProposalBuilderForm";
import { ProposalPageShell } from "@/modules/proposals/ProposalPageShell";
import { isValidRecordId } from "@/lib/isValidRecordId";

export const ProposalEdit = () => {
  const { id } = useParams();
  if (!isValidRecordId(id)) return null;

  return (
    <ProposalPageShell title="Edit proposal" backTo={`/proposals/${id}/show`}>
      <div className="w-full min-w-0">
        <ProposalBuilderForm proposalId={id} />
      </div>
    </ProposalPageShell>
  );
};
