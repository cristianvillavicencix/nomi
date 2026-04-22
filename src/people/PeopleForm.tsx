import { required } from "ra-core";
import { useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { CancelButton, SaveButton } from "@/components/admin";
import {
  AutocompleteInput,
  BooleanInput,
  EmailInput,
  NumberInput,
  PhoneInput,
  SelectInput,
  TextInput,
} from "@/components/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  bankAccountTypeChoices,
  compensationModeChoices,
  paymentMethodChoices,
  personStatusChoices,
  personTypeChoices,
  specialtyChoices,
} from "./constants";

type PersonType = "employee" | "salesperson" | "subcontractor";
type CompensationUnit = "hour" | "day" | "week" | "month";
type PaymentMethod = "cash" | "check" | "zelle" | "bank_deposit";

const requiresNameByType = (value: unknown, type: PersonType | undefined) => {
  if (type !== "employee" && type !== "salesperson") {
    return undefined;
  }
  if (typeof value === "string" && value.trim()) {
    return undefined;
  }
  return "Required";
};

const validateSubcontractorIdentity = (
  _value: unknown,
  values: Record<string, unknown>,
) => {
  if (values.type !== "subcontractor") return undefined;
  const businessName = String(values.business_name ?? "").trim();
  const firstName = String(values.first_name ?? "").trim();
  const lastName = String(values.last_name ?? "").trim();
  if (businessName || firstName || lastName) return undefined;
  return "Provide business name or first/last name";
};

const validateCompensationMode = (
  value: unknown,
  values: Record<string, unknown>,
) => {
  if (values.type !== "employee") return undefined;
  if (typeof value === "string" && value.length > 0) return undefined;
  return "Required";
};

export const normalizePeoplePayload = (rawData: Record<string, unknown>) => {
  const data = { ...rawData };
  const type = String(data.type ?? "employee") as PersonType;
  const compensationUnit = String(data.compensation_unit ?? "hour") as CompensationUnit;
  const compensationAmount = Number(data.compensation_amount ?? 0);
  const hourlyRate = Number(data.hourly_rate ?? 0);
  const dayRate = Number(data.day_rate ?? 0);
  const paymentMethod = String(data.payment_method ?? "");
  const defaultHoursPerWeek = Number(data.default_hours_per_week ?? 40);
  const workingDaysPerWeek = Number(data.working_days_per_week ?? 5);

  delete data.specialty_input;

  if (type === "employee") {
    data.compensation_unit = compensationUnit;
    data.compensation_amount = Number.isFinite(compensationAmount) ? compensationAmount : null;
    data.pay_type =
      compensationUnit === "week" || compensationUnit === "month"
        ? "salary"
        : compensationUnit === "day"
          ? "day_rate"
          : "hourly";
    data.compensation_mode =
      compensationUnit === "week" || compensationUnit === "month"
        ? "salary"
        : compensationUnit === "day"
          ? "day_rate"
          : "hourly";
    data.compensation_type =
      compensationUnit === "week"
        ? "weekly_salary"
        : compensationUnit === "month"
          ? "monthly_salary"
          : compensationUnit === "day"
            ? "daily"
            : "hourly";
    data.annual_salary =
      compensationUnit === "month" && Number.isFinite(compensationAmount)
        ? Number((compensationAmount * 12).toFixed(2))
        : null;
    data.hourly_rate =
      compensationUnit === "hour"
        ? (Number.isFinite(compensationAmount) ? compensationAmount : Number.isFinite(hourlyRate) ? hourlyRate : null)
        : null;
    data.day_rate =
      compensationUnit === "day"
        ? (Number.isFinite(compensationAmount) ? compensationAmount : Number.isFinite(dayRate) ? dayRate : null)
        : null;
    data.salary_rate = compensationUnit === "month" && Number.isFinite(compensationAmount) ? compensationAmount : null;
    data.weekly_salary_amount = compensationUnit === "week" && Number.isFinite(compensationAmount) ? compensationAmount : null;
    data.biweekly_salary_amount = null;
    data.monthly_salary_amount = compensationUnit === "month" && Number.isFinite(compensationAmount) ? compensationAmount : null;
    if (paymentMethod !== "bank_deposit") {
      data.bank_account_holder_name = null;
      data.bank_name = null;
      data.routing_number = null;
      data.account_number = null;
      data.account_type = null;
      data.bank_account_holder = null;
      data.bank_account_type = null;
      data.bank_routing_number = null;
      data.bank_account_number = null;
    } else {
      data.bank_account_holder = data.bank_account_holder_name ?? null;
      data.bank_account_type = data.account_type ?? null;
      data.bank_routing_number = data.routing_number ?? null;
      data.bank_account_number = data.account_number ?? null;
    }
    if (paymentMethod !== "zelle") {
      data.zelle_account_holder_name = null;
      data.zelle_contact = null;
    }
    if (paymentMethod !== "check") {
      data.check_pay_to_name = null;
    }
    data.default_hours_per_week = Number.isFinite(defaultHoursPerWeek)
      ? defaultHoursPerWeek
      : 40;
    data.working_days_per_week = Number.isFinite(workingDaysPerWeek)
      ? workingDaysPerWeek
      : 5;
    return data;
  }

  data.compensation_mode = null;
  data.compensation_unit = null;
  data.compensation_amount = null;
  data.compensation_type = null;
  data.pay_schedule = null;
  data.annual_salary = null;
  data.hourly_rate = null;
  data.day_rate = null;
  data.salary_rate = null;
  data.commission_rate = null;
  data.weekly_salary_amount = null;
  data.biweekly_salary_amount = null;
  data.monthly_salary_amount = null;
  data.payment_method = null;
  data.bank_account_holder_name = null;
  data.bank_name = null;
  data.routing_number = null;
  data.account_number = null;
  data.account_type = null;
  data.zelle_account_holder_name = null;
  data.zelle_contact = null;
  data.check_pay_to_name = null;
  data.bank_account_holder = null;
  data.bank_account_type = null;
  data.bank_routing_number = null;
  data.bank_account_number = null;
  data.default_hours_per_week = Number.isFinite(defaultHoursPerWeek)
    ? defaultHoursPerWeek
    : 40;
  data.working_days_per_week = Number.isFinite(workingDaysPerWeek)
    ? workingDaysPerWeek
    : 5;
  // Keep operational defaults for non-employees to avoid nulling non-null DB fields.
  data.overtime_enabled = Boolean(data.overtime_enabled ?? false);
  data.overtime_rate_multiplier = Number(data.overtime_rate_multiplier ?? 1.5);
  data.lunch_break_deducted = Boolean(data.lunch_break_deducted ?? true);
  data.default_lunch_minutes = Number(data.default_lunch_minutes ?? 30);
  data.paid_day_hours = Number(data.paid_day_hours ?? 8);
  data.off_days_paid = Boolean(data.off_days_paid ?? false);
  data.holidays_paid = Boolean(data.holidays_paid ?? false);
  data.sick_days_paid = Boolean(data.sick_days_paid ?? false);
  data.vacation_days_paid = Boolean(data.vacation_days_paid ?? false);
  data.sick_balance_days = Number(data.sick_balance_days ?? 0);
  data.vacation_balance_days = Number(data.vacation_balance_days ?? 0);
  data.emergency_contact_name = null;
  data.emergency_contact_phone = null;
  data.emergency_contact_relationship = null;
  data.emergency_notes = null;
  data.pay_type = type === "salesperson" ? "commission" : "day_rate";
  return data;
};

const FormToolbar = () => (
  <div role="toolbar" className="sticky pt-4 pb-4 md:pb-0 bottom-0 bg-linear-to-b from-transparent to-background to-10%">
    <div className="flex flex-row gap-2 justify-end">
      <CancelButton />
      <SaveButton type="button" transform={normalizePeoplePayload} label="Save" />
    </div>
  </div>
);

export const PeopleForm = () => {
  const config = useConfigurationContext();
  const type = useWatch({ name: "type" }) as PersonType | undefined;
  const compensationUnit = useWatch({ name: "compensation_unit" }) as CompensationUnit | undefined;
  const paymentMethod = useWatch({ name: "payment_method" }) as PaymentMethod | undefined;
  const [subcontractorSpecialties, setSubcontractorSpecialties] =
    useState(specialtyChoices);

  const allowCompensationAmount = type === "employee";

  const specialtyOptions = useMemo(() => subcontractorSpecialties, [subcontractorSpecialties]);

  const basicInfoCard = (
    <Card>
      <CardHeader>
        <CardTitle>Basic Info</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectInput
          source="type"
          label="Type"
          choices={personTypeChoices}
          validate={required()}
          helperText={false}
        />
        <SelectInput
          source="status"
          label="Status"
          choices={personStatusChoices}
          validate={required()}
          defaultValue="active"
          helperText={false}
        />
        <TextInput
          source="first_name"
          label="First name"
          validate={(value) => requiresNameByType(value, type)}
          helperText={false}
        />
        <TextInput
          source="last_name"
          label="Last name"
          validate={(value) => requiresNameByType(value, type)}
          helperText={false}
        />
        {type === "subcontractor" ? (
          <TextInput
            source="business_name"
            label="Business name"
            validate={validateSubcontractorIdentity}
            helperText={false}
          />
        ) : null}
        <EmailInput source="email" helperText={false} />
        <PhoneInput source="phone" helperText={false} />
        {type === "employee" ? (
          <TextInput
            source="identification_number"
            label="Identification number"
            helperText={false}
          />
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {type === "employee" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            {basicInfoCard}
            <Card>
              <CardHeader>
                <CardTitle>Employee Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextInput source="emergency_contact_name" label="Emergency contact name" helperText={false} />
                <PhoneInput source="emergency_contact_phone" label="Emergency contact phone" helperText={false} />
                <TextInput
                  source="emergency_contact_relationship"
                  label="Emergency contact relationship"
                  helperText={false}
                />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compensation & Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="rounded-md border p-4">
                    <h4 className="mb-3 text-sm font-semibold">Compensation Profile</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <SelectInput
                        source="compensation_unit"
                        label="How this employee earns"
                        choices={compensationModeChoices}
                        validate={validateCompensationMode}
                        helperText={false}
                      />
                      <SelectInput
                        source="payment_method"
                        label="Payment method"
                        choices={paymentMethodChoices}
                        helperText={false}
                        defaultValue="bank_deposit"
                      />
                      {allowCompensationAmount ? (
                        <NumberInput
                          source="compensation_amount"
                          label={
                            compensationUnit === "day"
                              ? "Amount per day"
                              : compensationUnit === "week"
                                ? "Amount per week"
                                : compensationUnit === "month"
                                  ? "Amount per month"
                                  : "Amount per hour"
                          }
                          step={0.01}
                          helperText={false}
                        />
                      ) : null}
                      {paymentMethod === "bank_deposit" ? (
                        <TextInput source="bank_account_holder_name" label="Account holder name" helperText={false} />
                      ) : null}
                      {paymentMethod === "bank_deposit" ? (
                        <TextInput source="bank_name" label="Bank name" helperText={false} />
                      ) : null}
                      {paymentMethod === "bank_deposit" ? (
                        <SelectInput
                          source="account_type"
                          label="Account type"
                          choices={bankAccountTypeChoices}
                          helperText={false}
                        />
                      ) : null}
                      {paymentMethod === "bank_deposit" ? (
                        <TextInput source="routing_number" label="Routing number (ABA)" helperText={false} />
                      ) : null}
                      {paymentMethod === "bank_deposit" ? (
                        <TextInput source="account_number" label="Account number" helperText={false} />
                      ) : null}
                      {paymentMethod === "zelle" ? (
                        <TextInput source="zelle_account_holder_name" label="Account holder name" helperText={false} />
                      ) : null}
                      {paymentMethod === "zelle" ? (
                        <TextInput source="zelle_contact" label="Zelle phone or email" helperText={false} />
                      ) : null}
                      {paymentMethod === "check" ? (
                        <TextInput source="check_pay_to_name" label="Pay to name" helperText={false} />
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-md border p-4">
                    <h4 className="mb-3 text-sm font-semibold">Paid Time Off</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <BooleanInput source="off_days_paid" label="Off days paid" />
                      <BooleanInput source="holidays_paid" label="Holidays paid" />
                      <BooleanInput source="sick_days_paid" label="Sick days paid" />
                      <BooleanInput source="vacation_days_paid" label="Vacation days paid" />
                      <NumberInput source="sick_balance_days" label="Sick balance days" step={0.5} helperText={false} />
                      <NumberInput source="vacation_balance_days" label="Vacation balance days" step={0.5} helperText={false} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        basicInfoCard
      )}

      {type === "salesperson" ? (
        <Card>
          <CardHeader>
            <CardTitle>Salesperson Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sales commissions are configured per project, not in People.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {type === "subcontractor" ? (
        <Card>
          <CardHeader>
            <CardTitle>Subcontractor Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AutocompleteInput
              source="specialty"
              label="Trade / Specialty"
              helperText="Optional, but recommended"
              choices={specialtyOptions}
              optionText="name"
              optionValue="id"
              onCreate={(value?: string) => {
                const trimmed = String(value ?? "").trim();
                if (!trimmed) return undefined;
                const nextOption = { id: trimmed.toLowerCase().replace(/\s+/g, "_"), name: trimmed };
                setSubcontractorSpecialties((current) => {
                  if (current.some((item) => item.id === nextOption.id)) return current;
                  return [...current, nextOption];
                });
                return nextOption;
              }}
              createItemLabel='Create "%{item}"'
              createLabel="Type to add specialty"
            />
          </CardContent>
        </Card>
      ) : null}

      <FormToolbar />
    </div>
  );
};
