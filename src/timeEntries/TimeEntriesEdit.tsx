import { Edit, SimpleForm } from "@/components/admin";
import { TimeEntriesForm } from "./TimeEntriesForm";

export const TimeEntriesEdit = () => (
  <Edit
    transform={(data) => {
      const { day_state, lunch_minutes, ...rest } = data;
      return rest;
    }}
  >
    <SimpleForm>
      <TimeEntriesForm />
    </SimpleForm>
  </Edit>
);
