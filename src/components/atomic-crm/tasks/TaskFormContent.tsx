import { TaskCoreFormFields } from "@/components/atomic-crm/tasks/TaskCoreFormFields";
import { TaskFormInitializer } from "@/components/atomic-crm/tasks/TaskFormInitializer";
import { WorkCreateAccountLinkFields } from "@/modules/work/WorkCreateAccountLinkFields";

export const TaskFormContent = ({
  defaultDealId,
  showAccountLink = true,
}: {
  selectContact?: boolean;
  contactFilter?: Record<string, string>;
  showAssignee?: boolean;
  showDealLink?: boolean;
  showAccountLink?: boolean;
  defaultDealId?: string | number | null;
}) => (
  <div className="flex flex-col gap-4">
    <TaskFormInitializer />
    <TaskCoreFormFields defaultDealId={defaultDealId} rows={4} />
    {showAccountLink ? <WorkCreateAccountLinkFields /> : null}
  </div>
);
