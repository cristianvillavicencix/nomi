import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import {
  PageLayout,
  ScrollableContentArea,
} from "@/components/atomic-crm/layout/page-shell";

export const ProposalPageShell = ({
  title,
  backTo = "/proposals",
  actions,
  children,
}: {
  title: string;
  backTo?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <PageLayout>
    <PageActions>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={backTo}>
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </Button>
      <PageTitle label={title} />
      {actions ? (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      ) : null}
    </PageActions>
    <ScrollableContentArea className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 md:px-6 lg:overflow-hidden">
      {children}
    </ScrollableContentArea>
  </PageLayout>
);
