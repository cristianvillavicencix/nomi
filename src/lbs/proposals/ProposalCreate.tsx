import { ProposalBuilderForm } from "@/lbs/proposals/ProposalBuilderForm";
import { ProposalPageShell } from "@/lbs/proposals/ProposalPageShell";

export const ProposalCreate = () => (
  <ProposalPageShell title="New proposal">
    <div className="max-w-6xl">
      <ProposalBuilderForm />
    </div>
  </ProposalPageShell>
);
