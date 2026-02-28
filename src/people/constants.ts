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
  { id: "day_rate", name: "Day Rate" },
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

export const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const formatRate = (person: Partial<Person>) => {
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
