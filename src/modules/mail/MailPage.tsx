import { PageActions, PageTitle } from "@/components/atomic-crm/layout/PageActions";
import { PageLayout } from "@/components/atomic-crm/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { MailWorkspace } from "./MailWorkspace";
import { useMailAccounts } from "./useMailAccounts";

export function MailPage() {
  const { data: accounts = [], isPending } = useMailAccounts();

  return (
    <PageLayout className="flex h-full min-h-0 flex-col gap-3">
      <PageActions>
        <PageTitle label="Mail" />
      </PageActions>
      <div className="min-h-0 flex-1">
        {isPending ? (
          <Skeleton className="h-full min-h-[400px] w-full" />
        ) : (
          <MailWorkspace accounts={accounts} />
        )}
      </div>
    </PageLayout>
  );
}
