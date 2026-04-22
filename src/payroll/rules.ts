import type { EmployeeLoan, PayrollRunLine, Person, TimeEntry } from '@/components/atomic-crm/types';

export type DayType =
  | 'worked_day'
  | 'holiday'
  | 'sick_day'
  | 'vacation_day'
  | 'day_off'
  | 'unpaid_leave';

export type PayrollSettings = {
  overtimeEnabledGlobally: boolean;
  overtimeWeeklyThreshold: number;
  defaultOvertimeMultiplier: number;
  defaultHoursPerWeekReference: number;
  lunchAutoSuggestHours: number;
  lunchAutoSuggestMinutes: number;
  usFederalHolidaysEnabled: boolean;
  defaultPaySchedule: 'weekly' | 'biweekly' | 'monthly';
  companyPaySchedule?: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  defaultPaymentMethod: 'cash' | 'check' | 'zelle' | 'bank_deposit';
  weeklyPayday: string;
  biweeklyAnchorDate: string;
  monthlyPayRule: 'end_of_month' | 'day_of_month';
  monthlyDayOfMonth: number;
  payday: string;
  payPeriodStartDay: number;
  payPeriodEndDay: number;
  customHolidays: Array<{ date: string; label: string }>;
};

export const defaultPayrollSettings: PayrollSettings = {
  overtimeEnabledGlobally: true,
  overtimeWeeklyThreshold: 40,
  defaultOvertimeMultiplier: 1.5,
  defaultHoursPerWeekReference: 40,
  lunchAutoSuggestHours: 6,
  lunchAutoSuggestMinutes: 30,
  usFederalHolidaysEnabled: true,
  defaultPaySchedule: 'biweekly',
  companyPaySchedule: 'biweekly',
  defaultPaymentMethod: 'bank_deposit',
  weeklyPayday: 'Friday',
  biweeklyAnchorDate: '2026-01-02',
  monthlyPayRule: 'end_of_month',
  monthlyDayOfMonth: 30,
  payday: 'Friday',
  payPeriodStartDay: 1,
  payPeriodEndDay: 14,
  customHolidays: [],
};

export type CompensationUnit = 'hour' | 'day' | 'week' | 'month' | 'commission';

export type PersonCompensationProfile = {
  unit: CompensationUnit;
  amount: number;
  label: string;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

export const getCompanyPaySchedule = (
  settings?: PayrollSettings,
): 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' =>
  settings?.companyPaySchedule ?? settings?.defaultPaySchedule ?? 'biweekly';

export const getPersonCompensationProfile = (
  person: Partial<Person>,
): PersonCompensationProfile => {
  if (person.compensation_unit && person.compensation_amount != null) {
    return {
      unit: person.compensation_unit,
      amount: Number(person.compensation_amount ?? 0),
      label: person.compensation_unit,
    };
  }

  if (person.compensation_type === 'weekly_salary') {
    return {
      unit: 'week',
      amount: Number(person.weekly_salary_amount ?? 0),
      label: 'week',
    };
  }

  if (person.compensation_type === 'biweekly_salary') {
    return {
      unit: 'week',
      amount: roundMoney(Number(person.biweekly_salary_amount ?? 0) / 2),
      label: 'week',
    };
  }

  if (person.compensation_type === 'monthly_salary' || person.pay_type === 'salary') {
    return {
      unit: 'month',
      amount: Number(person.monthly_salary_amount ?? person.salary_rate ?? 0),
      label: 'month',
    };
  }

  if (person.pay_type === 'day_rate') {
    return {
      unit: 'day',
      amount: Number(person.day_rate ?? 0),
      label: 'day',
    };
  }

  if (person.pay_type === 'commission' || person.compensation_type === 'commission') {
    return {
      unit: 'commission',
      amount: Number(person.commission_rate ?? 0),
      label: 'commission',
    };
  }

  return {
    unit: 'hour',
    amount: Number(person.hourly_rate ?? 0),
    label: 'hour',
  };
};

const getDaysInMonthForDate = (dateIso: string) => {
  const [year, month] = dateIso.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  // month is 1-12 from ISO format, day 0 gets last day of previous month
  // e.g., new Date(2024, 1, 0) = Jan 31, new Date(2024, 2, 0) = Feb 29 (leap)
  return new Date(year, month, 0).getDate();
};

export const calculateCompensationGross = ({
  person,
  regularHours,
  overtimeHours,
  paidLeaveHours,
  payPeriodStart,
  payPeriodEnd,
}: {
  person: Partial<Person>;
  regularHours: number;
  overtimeHours: number;
  paidLeaveHours: number;
  payPeriodStart: string;
  payPeriodEnd: string;
}) => {
  const profile = getPersonCompensationProfile(person);
  const payableHours = regularHours + overtimeHours + paidLeaveHours;
  const paidDayHours = Math.max(1, Number(person.paid_day_hours ?? 8));
  const periodDays = Math.max(
    1,
    Math.floor(
      (new Date(`${payPeriodEnd}T00:00:00`).getTime() -
        new Date(`${payPeriodStart}T00:00:00`).getTime()) /
        86400000,
    ) + 1,
  );

  if (profile.unit === 'hour') {
    const overtimeMultiplier = Math.max(1, Number(person.overtime_rate_multiplier ?? 1.5));
    return {
      profile,
      baseAmount: null,
      grossPay: roundMoney(
        regularHours * profile.amount +
          overtimeHours * profile.amount * overtimeMultiplier +
          paidLeaveHours * profile.amount,
      ),
    };
  }

  if (profile.unit === 'day') {
    const payableDays = payableHours / paidDayHours;
    return {
      profile,
      baseAmount: profile.amount,
      grossPay: roundMoney(payableDays * profile.amount),
    };
  }

  if (profile.unit === 'week') {
    return {
      profile,
      baseAmount: profile.amount,
      grossPay: roundMoney(profile.amount * (periodDays / 7)),
    };
  }

  if (profile.unit === 'month') {
    const daysInMonth = getDaysInMonthForDate(payPeriodStart);
    return {
      profile,
      baseAmount: profile.amount,
      grossPay: roundMoney(profile.amount * (periodDays / Math.max(1, daysInMonth))),
    };
  }

  return {
    profile,
    baseAmount: null,
    grossPay: 0,
  };
};

const toIso = (date: Date) => date.toISOString().slice(0, 10);

const nthWeekdayOfMonth = (
  year: number,
  month: number,
  weekday: number,
  nth: number,
) => {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - firstDay.getUTCDay() + 7) % 7;
  const date = 1 + offset + (nth - 1) * 7;
  return new Date(Date.UTC(year, month, date));
};

const lastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const offset = (lastDay.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, 0 - offset));
};

const observedHoliday = (date: Date) => {
  const day = date.getUTCDay();
  if (day === 6) {
    const observed = new Date(date);
    observed.setUTCDate(observed.getUTCDate() - 1);
    return observed;
  }
  if (day === 0) {
    const observed = new Date(date);
    observed.setUTCDate(observed.getUTCDate() + 1);
    return observed;
  }
  return date;
};

export const getUsFederalHolidayMap = (year: number): Record<string, string> => {
  const raw: Array<{ label: string; date: Date }> = [
    { label: "New Year's Day", date: new Date(Date.UTC(year, 0, 1)) },
    { label: 'Martin Luther King Jr. Day', date: nthWeekdayOfMonth(year, 0, 1, 3) },
    { label: "Washington's Birthday", date: nthWeekdayOfMonth(year, 1, 1, 3) },
    { label: 'Memorial Day', date: lastWeekdayOfMonth(year, 4, 1) },
    { label: 'Juneteenth National Independence Day', date: new Date(Date.UTC(year, 5, 19)) },
    { label: 'Independence Day', date: new Date(Date.UTC(year, 6, 4)) },
    { label: 'Labor Day', date: nthWeekdayOfMonth(year, 8, 1, 1) },
    { label: 'Columbus Day', date: nthWeekdayOfMonth(year, 9, 1, 2) },
    { label: 'Veterans Day', date: new Date(Date.UTC(year, 10, 11)) },
    { label: 'Thanksgiving Day', date: nthWeekdayOfMonth(year, 10, 4, 4) },
    { label: 'Christmas Day', date: new Date(Date.UTC(year, 11, 25)) },
  ];

  return raw.reduce<Record<string, string>>((acc, holiday) => {
    const observed = observedHoliday(holiday.date);
    acc[toIso(observed)] = holiday.label;
    return acc;
  }, {});
};

export const getHolidayLabelForDate = (
  dateIso: string,
  settings: PayrollSettings,
): string | null => {
  if (!dateIso) return null;

  const custom = settings.customHolidays.find((holiday) => holiday.date === dateIso);
  if (custom) return custom.label;

  if (!settings.usFederalHolidaysEnabled) return null;
  const year = Number(dateIso.slice(0, 4));
  const map = getUsFederalHolidayMap(year);
  return map[dateIso] ?? null;
};

export const calculateWorkedHoursRaw = (
  startTime?: string | null,
  endTime?: string | null,
): number => {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (end <= start) return 0;
  return Number(((end - start) / 60).toFixed(2));
};

export const calculatePayableHours = (
  workedHoursRaw: number,
  lunchMinutes: number,
): number => Number(Math.max(0, workedHoursRaw - lunchMinutes / 60).toFixed(2));

export const shouldSuggestLunch = (
  workedHoursRaw: number,
  settings: PayrollSettings,
): boolean => workedHoursRaw >= settings.lunchAutoSuggestHours;

export const toWeekKey = (dateIso: string): string => {
  const date = new Date(`${dateIso}T00:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
};

export const computeWeeklyOvertime = (
  entries: Array<Pick<TimeEntry, 'id' | 'date' | 'payable_hours' | 'day_type'>>,
  threshold = 40,
) => {
  const sorted = [...entries]
    .filter((entry) => (entry.day_type ?? 'worked_day') === 'worked_day')
    .sort((a, b) => a.date.localeCompare(b.date));

  let accumulated = 0;
  return sorted.map((entry) => {
    const hours = Number(entry.payable_hours ?? 0);
    const regular = Math.max(0, Math.min(hours, threshold - accumulated));
    const overtime = Math.max(0, hours - regular);
    accumulated += hours;
    return {
      id: entry.id,
      regular_hours: Number(regular.toFixed(2)),
      overtime_hours: Number(overtime.toFixed(2)),
    };
  });
};

export type HourlyPayResult = {
  regularPay: number;
  overtimePay: number;
  paidLeavePay: number;
  grossPay: number;
};

export const calculateHourlyPay = ({
  regularHours,
  overtimeHours,
  paidLeaveHours,
  hourlyRate,
  overtimeMultiplier,
}: {
  regularHours: number;
  overtimeHours: number;
  paidLeaveHours: number;
  hourlyRate: number;
  overtimeMultiplier: number;
}): HourlyPayResult => {
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * overtimeMultiplier;
  const paidLeavePay = paidLeaveHours * hourlyRate;
  const grossPay = regularPay + overtimePay + paidLeavePay;
  return {
    regularPay: Number(regularPay.toFixed(2)),
    overtimePay: Number(overtimePay.toFixed(2)),
    paidLeavePay: Number(paidLeavePay.toFixed(2)),
    grossPay: Number(grossPay.toFixed(2)),
  };
};

export const calculateSalariedDeduction = ({
  baseSalary,
  expectedDays,
  uncoveredFullDays,
  uncoveredHalfDays,
}: {
  baseSalary: number;
  expectedDays: number;
  uncoveredFullDays: number;
  uncoveredHalfDays: number;
}) => {
  if (expectedDays <= 0) {
    return { dailyRate: 0, deduction: 0, grossPay: Number(baseSalary.toFixed(2)) };
  }
  const dailyRate = baseSalary / expectedDays;
  const deduction = dailyRate * uncoveredFullDays + (dailyRate / 2) * uncoveredHalfDays;
  return {
    dailyRate: Number(dailyRate.toFixed(2)),
    deduction: Number(deduction.toFixed(2)),
    grossPay: Number(Math.max(0, baseSalary - deduction).toFixed(2)),
  };
};

export type LoanDeductionResult = {
  loanId: number;
  scheduledAmount: number;
  deductedAmount: number;
  remainingBalanceAfter: number;
};

export const isLoanDueForPayroll = (
  loan: Partial<EmployeeLoan>,
  payrollDateIso: string,
) => {
  if (!loan.active || loan.paused) return false;
  if (loan.repayment_schedule === 'specific_pay_date' && loan.first_deduction_date) {
    return payrollDateIso >= loan.first_deduction_date;
  }
  if (loan.start_next_payroll === false && !loan.first_deduction_date) return false;
  return true;
};

export const applyLoanDeductions = ({
  grossPay,
  otherDeductions,
  loans,
  payrollDateIso,
}: {
  grossPay: number;
  otherDeductions: number;
  loans: EmployeeLoan[];
  payrollDateIso?: string;
}) => {
  let availableForLoans = Math.max(0, grossPay - otherDeductions);
  const deductions: LoanDeductionResult[] = [];

  const activeLoans = loans
    .filter((loan) => (payrollDateIso ? isLoanDueForPayroll(loan, payrollDateIso) : loan.active && !loan.paused))
    .sort((a, b) => a.loan_date.localeCompare(b.loan_date));

  for (const loan of activeLoans) {
    if (availableForLoans <= 0) {
      deductions.push({
        loanId: Number(loan.id),
        scheduledAmount: Number(loan.fixed_installment_amount ?? 0),
        deductedAmount: 0,
        remainingBalanceAfter: Number(loan.remaining_balance ?? 0),
      });
      continue;
    }

    const scheduledAmount = Number(loan.fixed_installment_amount ?? 0);
    const remainingBalance = Number(loan.remaining_balance ?? 0);
    const deductedAmount = Math.max(
      0,
      Math.min(scheduledAmount, remainingBalance, availableForLoans),
    );
    availableForLoans -= deductedAmount;

    deductions.push({
      loanId: Number(loan.id),
      scheduledAmount: Number(scheduledAmount.toFixed(2)),
      deductedAmount: Number(deductedAmount.toFixed(2)),
      remainingBalanceAfter: Number((remainingBalance - deductedAmount).toFixed(2)),
    });
  }

  const totalLoanDeductions = Number(
    deductions.reduce((sum, item) => sum + item.deductedAmount, 0).toFixed(2),
  );

  const netPay = Number(
    Math.max(0, grossPay - otherDeductions - totalLoanDeductions).toFixed(2),
  );

  return {
    deductions,
    totalLoanDeductions,
    netPay,
  };
};

export const calculateLineTotals = (line: Partial<PayrollRunLine>) => {
  const grossPay = Number(line.gross_pay ?? 0);
  const loanDeductions = Number(line.loan_deductions ?? 0);
  const otherDeductions = Number(line.other_deductions ?? 0);
  const totalDeductions = Number((loanDeductions + otherDeductions).toFixed(2));
  const netPay = Number(Math.max(0, grossPay - totalDeductions).toFixed(2));

  return {
    totalDeductions,
    netPay,
  };
};
