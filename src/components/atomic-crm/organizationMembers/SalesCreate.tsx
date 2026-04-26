import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify, useRedirect } from "ra-core";
import type { SubmitHandler } from "react-hook-form";
import { SimpleForm } from "@/components/admin/simple-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CrmDataProvider } from "../providers/types";
import type { OrganizationMemberFormData } from "../types";
import { SalesInputs } from "./SalesInputs";

export function SalesCreate() {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const redirect = useRedirect();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: OrganizationMemberFormData) => {
      return dataProvider.organizationMemberCreate(data);
    },
    onSuccess: () => {
      notify(
        "User created. They will soon receive an email to set their password.",
      );
      redirect("/organization_members");
    },
    onError: (error) => {
      notify(error.message || "An error occurred while creating the user.", {
        type: "error",
      });
    },
  });
  const onSubmit: SubmitHandler<OrganizationMemberFormData> = async (data) => {
    mutate(data);
  };

  return (
    <div className="max-w-lg w-full mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a new user</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleForm onSubmit={onSubmit as SubmitHandler<any>}>
            <SalesInputs />
          </SimpleForm>
        </CardContent>
      </Card>
    </div>
  );
}
