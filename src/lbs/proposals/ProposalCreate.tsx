import { ProposalBuilderForm } from "@/lbs/proposals/ProposalBuilderForm";
import { ProposalPageShell } from "@/lbs/proposals/ProposalPageShell";

export const ProposalCreate = () => (
  <ProposalPageShell title="New proposal">
    <div className="w-full min-w-0">
      <ProposalBuilderForm />
    </div>
  </ProposalPageShell>
);
