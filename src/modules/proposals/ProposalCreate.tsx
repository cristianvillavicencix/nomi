import { ProposalBuilderForm } from "@/modules/proposals/ProposalBuilderForm";
import { ProposalPageShell } from "@/modules/proposals/ProposalPageShell";

export const ProposalCreate = () => (
  <ProposalPageShell title="New proposal">
    <div className="w-full min-w-0">
      <ProposalBuilderForm />
    </div>
  </ProposalPageShell>
);
