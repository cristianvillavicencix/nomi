import { Create, SimpleForm } from "@/components/admin";
import { TimeEntriesForm } from "./TimeEntriesForm";

export const TimeEntriesCreate = () => (
  <Create
    transform={(data) => {
      const { day_state, lunch_minutes, ...rest } = data;
      return rest;
    }}
  >
    <SimpleForm defaultValues={{ org_id: 1, status: 'draft' }}>
      <TimeEntriesForm />
    </SimpleForm>
  </Create>
);
