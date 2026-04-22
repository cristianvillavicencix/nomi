import { Create, SimpleForm } from "@/components/admin";
import { useLocation, useNavigate } from "react-router";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { getCompanyPaySchedule } from "@/payroll/rules";
import { PeopleForm } from "./PeopleForm";

export const PeopleCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const config = useConfigurationContext();
  const type = new URLSearchParams(location.search).get("type");
  const payrollSettings = config.payrollSettings;
  const normalizedType =
    type === "employee" || type === "salesperson" || type === "subcontractor"
      ? type
      : "employee";

  return (
    <Create
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          navigate(`/people?type=${normalizedType}`);
        },
      }}
    >
      <SimpleForm
        className="max-w-none"
        toolbar={null}
        defaultValues={{
          org_id: 1,
          status: "active",
          pay_type: "hourly",
          compensation_type: "hourly",
          compensation_mode: "hourly",
          compensation_unit: "hour",
          compensation_amount: null,
          overtime_enabled: false,
          overtime_rate_multiplier:
            Number(payrollSettings?.defaultOvertimeMultiplier ?? 1.5),
          lunch_break_deducted: true,
          paid_day_hours: 8,
          default_hours_per_week:
            Number(payrollSettings?.defaultHoursPerWeekReference ?? 40),
          working_days_per_week: 5,
          payment_method: payrollSettings?.defaultPaymentMethod ?? "bank_deposit",
          off_days_paid: false,
          holidays_paid: true,
          sick_days_paid: false,
          vacation_days_paid: false,
          sick_balance_days: 0,
          vacation_balance_days: 0,
          pay_schedule: getCompanyPaySchedule(payrollSettings),
          annual_salary: null,
          bank_account_holder_name: "",
          bank_name: "",
          routing_number: "",
          account_number: "",
          account_type: "checking",
          zelle_account_holder_name: "",
          zelle_contact: "",
          check_pay_to_name: "",
          type: normalizedType,
        }}
      >
        <PeopleForm />
      </SimpleForm>
    </Create>
  );
};
