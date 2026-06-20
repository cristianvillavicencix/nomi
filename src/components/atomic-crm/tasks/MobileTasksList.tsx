import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { TasksPageContent } from "./TasksPageContent";

export const MobileTasksList = () => (
  <>
    <MobileHeader>
      <h1 className="text-xl font-semibold">Calendar</h1>
    </MobileHeader>
    <MobileContent>
      <TasksPageContent />
    </MobileContent>
  </>
);
