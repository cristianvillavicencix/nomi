import { ProposalBuilderForm } from "@/modules/proposals/ProposalBuilderForm";
import { ProposalPageShell } from "@/modules/proposals/ProposalPageShell";

export const ProposalCreate = () => (
  <ProposalPageShell title="New proposal">
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <ProposalBuilderForm />
    </div>
  </ProposalPageShell>
);
