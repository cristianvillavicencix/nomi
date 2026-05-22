import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { AddTask } from "./AddTask";
import { TasksPageContent } from "./TasksPageContent";

export const MobileTasksList = () => (
  <>
    <MobileHeader>
      <h1 className="text-xl font-semibold">Tasks</h1>
      <AddTask display="icon" selectContact />
    </MobileHeader>
    <MobileContent>
      <TasksPageContent />
    </MobileContent>
  </>
);
