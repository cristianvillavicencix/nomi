import { Create, SimpleForm } from "@/components/admin";
import { useLocation } from "react-router";
import { PeopleForm } from "./PeopleForm";

export const PeopleCreate = () => {
  const location = useLocation();
  const type = new URLSearchParams(location.search).get("type");

  return (
    <Create>
      <SimpleForm
        defaultValues={{
          org_id: 1,
          status: "active",
          pay_type: "hourly",
          type:
            type === "employee" ||
            type === "salesperson" ||
            type === "subcontractor"
              ? type
              : "employee",
        }}
      >
        <PeopleForm />
      </SimpleForm>
    </Create>
  );
};
