import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import {
  EmailInput,
  NumberInput,
  PhoneInput,
  SelectInput,
  TextInput,
} from "@/components/admin";
import { payTypeChoices, personStatusChoices, personTypeChoices } from "./constants";

export const PeopleForm = () => {
  const { setValue } = useFormContext();
  const payType = useWatch({ name: "pay_type" }) as
    | "hourly"
    | "day_rate"
    | "salary"
    | "commission"
    | undefined;

  const clearUnusedRates = (nextPayType: string) => {
    if (nextPayType !== "hourly") setValue("hourly_rate", null);
    if (nextPayType !== "day_rate") setValue("day_rate", null);
    if (nextPayType !== "salary") setValue("salary_rate", null);
    if (nextPayType !== "commission") setValue("commission_rate", null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
      <EmailInput source="email" helperText={false} />
      <PhoneInput source="phone" helperText={false} />
      <SelectInput
        source="type"
        choices={personTypeChoices}
        validate={required()}
        helperText={false}
      />
      <SelectInput
        source="status"
        choices={personStatusChoices}
        defaultValue="active"
        helperText={false}
      />
      <SelectInput
        source="pay_type"
        choices={payTypeChoices}
        validate={required()}
        helperText={false}
        onChange={(event) => clearUnusedRates(event.target.value)}
      />
      {payType === "hourly" ? (
        <NumberInput source="hourly_rate" step={0.01} helperText={false} />
      ) : null}
      {payType === "day_rate" ? (
        <NumberInput source="day_rate" step={0.01} helperText={false} />
      ) : null}
      {payType === "salary" ? (
        <NumberInput source="salary_rate" step={0.01} helperText={false} />
      ) : null}
      {payType === "commission" ? (
        <NumberInput source="commission_rate" step={0.01} helperText={false} />
      ) : null}
      <NumberInput source="org_id" defaultValue={1} helperText={false} />
    </div>
  );
};
