import { ProjectCalendarEventsList } from "@/lbs/calendar/ProjectCalendarEventsList";
import type { LbsDeal } from "@/lbs/types";

export const ProjectScheduleTab = ({ record }: { record: LbsDeal }) => (
  <div className="space-y-4">
    <ProjectCalendarEventsList dealId={record.id} title="Project schedule" />
    <div className="rounded-lg border p-4 text-sm">
      <div className="text-muted-foreground">Target launch</div>
      <div className="font-medium">
        {record.expected_end_date
          ? new Date(
              `${record.expected_end_date}T12:00:00`,
            ).toLocaleDateString()
          : "Not set — update in Settings"}
      </div>
    </div>
  </div>
);
