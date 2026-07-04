import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

type ShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export const TicketSettingsPanelShell = ({
  title,
  description,
  children,
}: ShellProps) => {
  const { isPending } = useTicketWorkspaceSettingsContext();

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading ticket settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title={title}
        description={description}
        status="connected"
        badgeLabel="Workspace"
      />
      {children}
    </div>
  );
};
