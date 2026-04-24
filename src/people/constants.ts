import type { Person } from "@/components/atomic-crm/types";

export const personTypeChoices = [
  { id: "employee", name: "Employee" },
  { id: "salesperson", name: "Salesperson" },
  { id: "subcontractor", name: "Subcontractor" },
] as const;

export const personStatusChoices = [
  { id: "active", name: "Active" },
  { id: "inactive", name: "Inactive" },
] as const;

export const payTypeChoices = [
  { id: "hourly", name: "Hourly" },
  { id: "salary", name: "Salary" },
  { id: "commission", name: "Commission" },
  { id: "day_rate", name: "Daily" },
] as const;

export const compensationModeChoices = [
  { id: "hour", name: "Per Hour" },
  { id: "day", name: "Per Day" },
  { id: "week", name: "Per Week" },
  { id: "month", name: "Per Month" },
  { id: "year", name: "Salary (annual)" },
] as const;

export const compensationTypeChoices = [
  { id: "hourly", name: "Hourly" },
  { id: "weekly_salary", name: "Weekly Salary" },
  { id: "biweekly_salary", name: "Biweekly Salary" },
  { id: "monthly_salary", name: "Monthly Salary" },
  { id: "commission", name: "Commission (Optional)" },
] as const;

export const payScheduleChoices = [
  { id: "weekly", name: "Weekly" },
  { id: "biweekly", name: "Biweekly" },
  { id: "semimonthly", name: "Semi-Monthly" },
  { id: "monthly", name: "Monthly" },
] as const;

export const specialtyChoices = [
  { id: "roofing", name: "Roofing" },
  { id: "siding", name: "Siding" },
  { id: "gutters", name: "Gutters" },
  { id: "painting", name: "Painting" },
  { id: "mitigation", name: "Mitigation" },
  { id: "reconstruction", name: "Reconstruction" },
  { id: "plumbing", name: "Plumbing" },
  { id: "electrical", name: "Electrical" },
  { id: "other", name: "Other" },
] as const;

export const paymentMethodChoices = [
  { id: "cash", name: "Cash" },
  { id: "check", name: "Check" },
  { id: "zelle", name: "Zelle" },
  { id: "bank_deposit", name: "Bank Deposit" },
] as const;

export const bankAccountTypeChoices = [
  { id: "checking", name: "Checking" },
  { id: "savings", name: "Savings" },
] as const;

export const personTypeLabels: Record<Person["type"], string> = {
  employee: "Employee",
  salesperson: "Salesperson",
  subcontractor: "Subcontractor",
};

export const payTypeLabels: Record<Person["pay_type"], string> = {
  hourly: "Hourly",
  salary: "Salary",
  commission: "Commission",
  day_rate: "Day Rate",
};

export const compensationTypeLabels = {
  hourly: "Hourly",
  daily: "Daily",
  weekly_salary: "Weekly Salary",
  biweekly_salary: "Biweekly Salary",
  monthly_salary: "Monthly Salary",
  commission: "Commission",
} as const;

export const compensationUnitLabels = {
  hour: "Per Hour",
  day: "Per Day",
  week: "Per Week",
  month: "Per Month",
  year: "Salary (annual)",
  commission: "Commission",
} as const;

export const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const formatRate = (person: Partial<Person>) => {
  if (person.compensation_unit && person.compensation_amount != null) {
    const suffix =
      person.compensation_unit === "hour"
        ? "/ hr"
        : person.compensation_unit === "day"
          ? "/ day"
          : person.compensation_unit === "week"
            ? "/ week"
            : person.compensation_unit === "month"
              ? "/ month"
              : person.compensation_unit === "year"
                ? " / year"
                : "";
    return `${formatMoney(person.compensation_amount)}${suffix}`;
  }

  const compensationType = person.compensation_type;
  if (compensationType === "weekly_salary") {
    return `${formatMoney(person.weekly_salary_amount)} / week`;
  }
  if (compensationType === "monthly_salary") {
    return `${formatMoney(person.monthly_salary_amount)} / month`;
  }
  if (compensationType === "biweekly_salary") {
    return `${formatMoney(person.biweekly_salary_amount)} / 2 weeks`;
  }
  if (compensationType === "commission") {
    return `${Number(person.commission_rate ?? 0).toFixed(2)}%`;
  }
  switch (person.pay_type) {
    case "hourly":
      return `${formatMoney(person.hourly_rate)} / hr`;
    case "day_rate":
      return `${formatMoney(person.day_rate)} / day`;
    case "salary":
      return `${formatMoney(person.salary_rate)} / salary`;
    case "commission":
      return `${Number(person.commission_rate ?? 0).toFixed(2)}%`;
    default:
      return "-";
  }
};

export const getPersonDisplayName = (person: Partial<Person>) =>
  `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
