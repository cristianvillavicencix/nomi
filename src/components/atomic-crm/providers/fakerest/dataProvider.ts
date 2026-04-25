import {
  withLifecycleCallbacks,
  type CreateParams,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
  type UpdateParams,
} from "ra-core";
import fakeRestDataProvider from "ra-data-fakerest";

import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  EmailAndType,
  Payment,
  PayrollRun,
  PhoneNumberAndType,
  Sale,
  SalesFormData,
  SignUpData,
  Task,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { withCurrentProductName } from "../../root/defaultConfiguration";
import { isValidEmail } from "@/utils/email";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { getActivityLog } from "../commons/activity";
import { getCompanyAvatar } from "../commons/getCompanyAvatar";
import { getContactAvatar } from "../commons/getContactAvatar";
import { mergeContacts } from "../commons/mergeContacts";
import {
  applyLoanDeductions,
  calculateCompensationGross,
  getPersonCompensationProfile,
} from "@/payroll/rules";
import { buildReceiptNumber, normalizeLoanPayload } from "@/loans/helpers";
import { canApprovePayroll } from "@/payroll/permissions";
import { canMutateCrmResource } from "../commons/crmPermissions";
import type { CrmDataProvider } from "../types";
import { authProvider, USER_STORAGE_KEY } from "./authProvider";
import generateData from "./dataGenerator";
import { withSupabaseFilterAdapter } from "./internal/supabaseAdapter";

const baseDataProvider = fakeRestDataProvider(generateData(), true, 300);

const TASK_MARKED_AS_DONE = "TASK_MARKED_AS_DONE";
const TASK_MARKED_AS_UNDONE = "TASK_MARKED_AS_UNDONE";
const TASK_DONE_NOT_CHANGED = "TASK_DONE_NOT_CHANGED";
let taskUpdateType = TASK_DONE_NOT_CHANGED;

const processCompanyLogo = async (params: any) => {
  let logo = params.data.logo;

  if (typeof logo !== "object" || logo === null || !logo.src) {
    logo = await getCompanyAvatar(params.data);
  } else if (logo.rawFile instanceof File) {
    const base64Logo = await convertFileToBase64(logo);
    logo = { src: base64Logo, title: logo.title };
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

const normalizeEmailValue = (value?: string | null, label = "email") => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!isValidEmail(trimmed)) {
    throw new Error(`Invalid ${label}`);
  }

  return trimmed;
};

const normalizePhoneValue = (value?: string | null, label = "phone") => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = normalizeUsPhoneToE164(trimmed);
  if (!normalized) {
    throw new Error(`Invalid ${label}. Use 10 digits`);
  }

  return normalized;
};

const normalizeEmailEntries = (entries?: EmailAndType[]) =>
  entries
    ?.map((entry) => {
      const email = normalizeEmailValue(entry.email, "email");
      return email ? { ...entry, email } : null;
    })
    .filter((entry): entry is EmailAndType => entry != null);

const normalizePhoneEntries = (entries?: PhoneNumberAndType[]) =>
  entries
    ?.map((entry) => {
      const number = normalizePhoneValue(entry.number);
      return number ? { ...entry, number } : null;
    })
    .filter((entry): entry is PhoneNumberAndType => entry != null);

const normalizeContactData = <
  T extends {
    email_jsonb?: EmailAndType[];
    phone_jsonb?: PhoneNumberAndType[];
  },
>(
  data: T,
): T => ({
  ...data,
  email_jsonb: normalizeEmailEntries(data.email_jsonb),
  phone_jsonb: normalizePhoneEntries(data.phone_jsonb),
});

async function processContactAvatar(
  params: UpdateParams<Contact>,
): Promise<UpdateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact>,
): Promise<CreateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact> | UpdateParams<Contact>,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  if (data.avatar?.src || !data.email_jsonb || !data.email_jsonb.length) {
    return params;
  }
  const avatarUrl = await getContactAvatar(data);

  // Clone the data and modify the clone
  const newData = { ...data, avatar: { src: avatarUrl || undefined } };

  return { ...params, data: newData };
}

async function fetchAndUpdateCompanyData(
  params: UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<UpdateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact> | UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  const newData = { ...data };

  if (!newData.company_id) {
    return params;
  }

  const { data: company } = await dataProvider.getOne("companies", {
    id: newData.company_id,
  });

  if (!company) {
    return params;
  }

  newData.company_name = company.name;
  return { ...params, data: newData };
}

const dataProviderWithCustomMethod: CrmDataProvider = {
  ...baseDataProvider,
  getList: async (resource: string, params: GetListParams) => {
    let request = params;
    if (
      resource === "time_entries" &&
      params.filter &&
      typeof params.filter === "object" &&
      "__hours_all_statuses" in params.filter
    ) {
      const { __hours_all_statuses: _legacy, ...rest } =
        params.filter as Record<string, unknown>;
      request = { ...params, filter: rest };
    }
    return baseDataProvider.getList(resource, request);
  },
  create: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "create",
        data: params?.data,
      })
    ) {
      throw new Error(`Not authorized to create ${resource}`);
    }
    return baseDataProvider.create(resource, params);
  },
  update: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "update",
        data: params?.data,
      })
    ) {
      throw new Error(`Not authorized to update ${resource}`);
    }
    if (
      resource === "time_entries" &&
      params?.data?.status === "approved" &&
      !canApprovePayroll(params?.meta?.identity ?? identity)
    ) {
      throw new Error("Only owner/admin/accountant can approve time entries");
    }
    return baseDataProvider.update(resource, params);
  },
  updateMany: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "update",
        data: params?.data,
      })
    ) {
      throw new Error(`Not authorized to update ${resource}`);
    }
    if (
      resource === "time_entries" &&
      params?.data?.status === "approved" &&
      !canApprovePayroll(params?.meta?.identity ?? identity)
    ) {
      throw new Error("Only owner/admin/accountant can approve time entries");
    }
    return baseDataProvider.updateMany(resource, params);
  },
  delete: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "delete",
        data: params?.previousData,
      })
    ) {
      throw new Error(`Not authorized to delete ${resource}`);
    }
    return baseDataProvider.delete(resource, params);
  },
  deleteMany: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "delete",
        data: params?.previousData,
      })
    ) {
      throw new Error(`Not authorized to delete ${resource}`);
    }
    return baseDataProvider.deleteMany(resource, params);
  },
  unarchiveDeal: async (deal: Deal) => {
    // get all deals where stage is the same as the deal to unarchive
    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      filter: { stage: deal.stage },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "index", order: "ASC" },
    });

    // set index for each deal starting from 1, if the deal to unarchive is found, set its index to the last one
    const updatedDeals = deals.map((d, index) => ({
      ...d,
      index: d.id === deal.id ? 0 : index + 1,
      archived_at: d.id === deal.id ? null : d.archived_at,
    }));

    return await Promise.all(
      updatedDeals.map((updatedDeal) =>
        dataProvider.update("deals", {
          id: updatedDeal.id,
          data: updatedDeal,
          previousData: deals.find((d) => d.id === updatedDeal.id),
        }),
      ),
    );
  },
  // We simulate a remote endpoint that is in charge of returning activity log
  getActivityLog: async (companyId?: Identifier) => {
    return getActivityLog(dataProvider, companyId);
  },
  signUp: async ({
    email,
    password,
    first_name,
    last_name,
    company_name: _company_name,
  }: SignUpData): Promise<{ id: string; email: string; password: string }> => {
    const normalizedEmail = normalizeEmailValue(email, "email")!;
    const user = await baseDataProvider.create("sales", {
      data: {
        email: normalizedEmail,
        first_name,
        last_name,
      },
    });

    return {
      ...user.data,
      email: normalizedEmail,
      password,
    };
  },
  salesCreate: async ({ ...data }: SalesFormData): Promise<Sale> => {
    const response = await dataProvider.create("sales", {
      data: {
        ...data,
        email: normalizeEmailValue(data.email, "email")!,
        password: "new_password",
      },
    });

    return response.data;
  },
  salesUpdate: async (
    id: Identifier,
    data: Partial<Omit<SalesFormData, "password">>,
  ): Promise<Sale> => {
    const { data: previousData } = await dataProvider.getOne<Sale>("sales", {
      id,
    });

    if (!previousData) {
      throw new Error("User not found");
    }

    const { data: sale } = await dataProvider.update<Sale>("sales", {
      id,
      data: {
        ...data,
        email: normalizeEmailValue(data.email, "email"),
      },
      previousData,
    });
    return { ...sale, user_id: sale.id.toString() };
  },
  isInitialized: async (): Promise<boolean> => {
    const sales = await dataProvider.getList<Sale>("sales", {
      filter: {},
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    if (sales.data.length === 0) {
      return false;
    }
    return true;
  },
  updatePassword: async (id: Identifier): Promise<true> => {
    const currentUser = await authProvider.getIdentity?.();
    if (!currentUser) {
      throw new Error("User not found");
    }
    const { data: previousData } = await dataProvider.getOne<Sale>("sales", {
      id: currentUser.id,
    });

    if (!previousData) {
      throw new Error("User not found");
    }

    await dataProvider.update("sales", {
      id,
      data: {
        password: "demo_newPassword",
      },
      previousData,
    });

    return true;
  },
  mergeContacts: async (sourceId: Identifier, targetId: Identifier) => {
    return mergeContacts(sourceId, targetId, baseDataProvider);
  },
  getConfiguration: async (): Promise<ConfigurationContextValue> => {
    const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
    const raw = (data?.config as ConfigurationContextValue) ?? {};
    return withCurrentProductName(raw) as ConfigurationContextValue;
  },
  updateConfiguration: async (
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> => {
    const { data: prev } = await baseDataProvider.getOne("configuration", {
      id: 1,
    });
    await baseDataProvider.update("configuration", {
      id: 1,
      data: { config },
      previousData: prev,
    });
    return config;
  },
  generatePaymentLines: async (paymentId: Identifier): Promise<number> => {
    const { data: payment } = await dataProvider.getOne<any>("payments", {
      id: paymentId,
    });
    const paymentCategory = payment.category ?? "mixed";

    const { data: approvedEntries } = await dataProvider.getList<any>(
      "time_entries",
      {
        filter: {
          status: "approved",
          "date@gte": payment.pay_period_start,
          "date@lte": payment.pay_period_end,
        },
        pagination: { page: 1, perPage: 10_000 },
        sort: { field: "id", order: "ASC" },
      },
    );

    const { data: existingLines } = await dataProvider.getList<any>(
      "payment_lines",
      {
        filter: { source_type: "time_entry" },
        pagination: { page: 1, perPage: 10_000 },
        sort: { field: "id", order: "ASC" },
      },
    );

    const linkedTimeEntryIds = new Set(
      existingLines
        .filter((line) => line.source_type === "time_entry")
        .map((line) => line.source_id),
    );

    const { data: allPeople } = await dataProvider.getList<any>("people", {
      filter: { status: "active" },
      pagination: { page: 1, perPage: 10_000 },
      sort: { field: "id", order: "ASC" },
    });

    let createdCount = 0;

    if (paymentCategory === "hourly" || paymentCategory === "mixed") {
      for (const entry of approvedEntries) {
        if (linkedTimeEntryIds.has(entry.id)) {
          continue;
        }

        const person = allPeople.find(
          (candidate) => candidate.id === entry.person_id,
        );
        const compensation = getPersonCompensationProfile(person ?? {});
        if (compensation.unit !== "hour" && compensation.unit !== "day") {
          continue;
        }

        const rate =
          compensation.unit === "day"
            ? Number(person?.day_rate ?? compensation.amount ?? 0) /
              Math.max(1, Number(person?.paid_day_hours ?? 8))
            : Number(person?.hourly_rate ?? compensation.amount ?? 0);
        const regularHours = Number(
          entry.regular_hours ?? Math.min(entry.hours ?? 0, 8),
        );
        const overtimeHours = Number(
          entry.overtime_hours ?? Math.max(0, Number(entry.hours ?? 0) - 8),
        );
        const overtimeMultiplier = Number(
          person?.overtime_rate_multiplier ?? 1.5,
        );
        const overtimeEnabled = Boolean(person?.overtime_enabled);
        const regularPay = Number((regularHours * rate).toFixed(2));
        const overtimePay = Number(
          (
            overtimeHours *
            rate *
            (overtimeEnabled ? overtimeMultiplier : 1)
          ).toFixed(2),
        );
        const totalPay = Number((regularPay + overtimePay).toFixed(2));

        await dataProvider.create("payment_lines", {
          data: {
            payment_id: paymentId,
            person_id: entry.person_id,
            project_id: entry.project_id,
            compensation_type: compensation.unit === "day" ? "daily" : "hourly",
            compensation_unit: compensation.unit,
            compensation_amount: compensation.amount,
            source_type: "time_entry",
            source_id: entry.id,
            source_reference: `time_entry:${entry.id}`,
            qty_hours: entry.hours,
            regular_hours: regularHours,
            overtime_hours: overtimeHours,
            rate,
            regular_pay: regularPay,
            overtime_pay: overtimePay,
            bonuses: 0,
            deductions: 0,
            total_pay: totalPay,
            amount: totalPay,
            notes: `Generated from time entry #${entry.id}`,
          },
        });
        createdCount++;
      }
    }

    if (paymentCategory === "salaried" || paymentCategory === "mixed") {
      const start = new Date(`${payment.pay_period_start}T00:00:00`);
      const end = new Date(`${payment.pay_period_end}T00:00:00`);
      const periodDays = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
      );

      for (const person of allPeople) {
        const compensation = getPersonCompensationProfile(person ?? {});
        if (compensation.unit !== "week" && compensation.unit !== "month") {
          continue;
        }

        const salaryAmount =
          compensation.unit === "week"
            ? Number((compensation.amount * (periodDays / 7)).toFixed(2))
            : Number(
                (
                  compensation.amount *
                  (periodDays /
                    new Date(
                      start.getFullYear(),
                      start.getMonth() + 1,
                      0,
                    ).getDate())
                ).toFixed(2),
              );

        if (!salaryAmount) continue;

        await dataProvider.create("payment_lines", {
          data: {
            payment_id: paymentId,
            person_id: person.id,
            project_id: null,
            compensation_type:
              compensation.unit === "week" ? "weekly_salary" : "monthly_salary",
            compensation_unit: compensation.unit,
            compensation_amount: compensation.amount,
            source_type: "salary",
            source_id: person.id,
            source_reference: `salary:${person.id}`,
            qty_hours: null,
            regular_hours: null,
            overtime_hours: null,
            rate: null,
            regular_pay: salaryAmount,
            overtime_pay: 0,
            bonuses: 0,
            deductions: 0,
            total_pay: salaryAmount,
            amount: salaryAmount,
            notes: "Generated salaried base line",
          },
        });
        createdCount++;
      }
    }

    if (
      paymentCategory === "sales_commissions" ||
      paymentCategory === "mixed"
    ) {
      const { data: wonDeals } = await dataProvider.getList<any>("deals", {
        filter: {
          stage: "won",
          "expected_closing_date@gte": payment.pay_period_start,
          "expected_closing_date@lte": payment.pay_period_end,
        },
        pagination: { page: 1, perPage: 10_000 },
        sort: { field: "id", order: "ASC" },
      });

      for (const deal of wonDeals) {
        // Support multiple salespersons per deal
        const salespersonIds = [
          deal.sales_id,
          ...(deal.salesperson_ids || []),
        ].filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates

        for (const salespersonId of salespersonIds) {
          const person = allPeople.find(
            (candidate) => candidate.id === salespersonId,
          );
          if (!person || person.type !== "salesperson") continue;

          const rate = Number(person.commission_rate ?? 0);
          const totalPay = Number(
            ((Number(deal.amount ?? 0) * rate) / 100).toFixed(2),
          );

          await dataProvider.create("payment_lines", {
            data: {
              payment_id: paymentId,
              person_id: person.id,
              project_id: deal.id,
              compensation_type: "commission",
              source_type: "commission",
              source_id: deal.id,
              source_reference: `commission:deal:${deal.id}`,
              qty_hours: null,
              regular_hours: null,
              overtime_hours: null,
              rate,
              regular_pay: totalPay,
              overtime_pay: 0,
              bonuses: 0,
              deductions: 0,
              total_pay: totalPay,
              amount: totalPay,
              notes: `Generated commission from project #${deal.id}`,
            },
          });
          createdCount++;
        }
      }
    }

    return createdCount;
  },
  generatePayrollRun: async (payrollRunId: Identifier): Promise<number> => {
    const { data: payrollRun } = await dataProvider.getOne<any>(
      "payroll_runs",
      {
        id: payrollRunId,
      },
    );

    const { data: people } = await dataProvider.getList<any>("people", {
      filter: { status: "active" },
      pagination: { page: 1, perPage: 10_000 },
      sort: { field: "id", order: "ASC" },
    });

    const { data: approvedEntries } = await dataProvider.getList<any>(
      "time_entries",
      {
        filter: {
          status: "approved",
          "date@gte": payrollRun.pay_period_start,
          "date@lte": payrollRun.pay_period_end,
        },
        pagination: { page: 1, perPage: 10_000 },
        sort: { field: "date", order: "ASC" },
      },
    );

    const { data: loans } = await dataProvider.getList<any>("employee_loans", {
      filter: { active: true },
      pagination: { page: 1, perPage: 10_000 },
      sort: { field: "loan_date", order: "ASC" },
    });

    let createdCount = 0;

    for (const person of people) {
      const compensation = getPersonCompensationProfile(person);
      const personEntries = approvedEntries.filter(
        (entry) => entry.person_id === person.id,
      );
      const regularHours = Number(
        personEntries
          .reduce((sum, entry) => sum + Number(entry.regular_hours ?? 0), 0)
          .toFixed(2),
      );
      const overtimeHours = Number(
        personEntries
          .reduce((sum, entry) => sum + Number(entry.overtime_hours ?? 0), 0)
          .toFixed(2),
      );
      const paidLeaveHours = Number(
        personEntries
          .filter((entry) =>
            ["holiday", "sick_day", "vacation_day", "day_off"].includes(
              entry.day_type ?? "worked_day",
            ),
          )
          .reduce((sum, entry) => sum + Number(entry.payable_hours ?? 0), 0)
          .toFixed(2),
      );

      if (compensation.unit === "commission") {
        continue;
      }
      const compensationResult = calculateCompensationGross({
        person,
        regularHours,
        overtimeHours,
        paidLeaveHours,
        payPeriodStart: payrollRun.pay_period_start,
        payPeriodEnd: payrollRun.pay_period_end,
      });

      let grossPay = compensationResult.grossPay;
      let baseSalaryAmount = compensationResult.baseAmount ?? 0;

      grossPay = Number(grossPay.toFixed(2));
      if (grossPay <= 0) continue;

      const personLoans = loans.filter(
        (loan) => loan.employee_id === person.id && !loan.paused,
      );
      const loanResult = applyLoanDeductions({
        grossPay,
        otherDeductions: 0,
        loans: personLoans,
        payrollDateIso: payrollRun.payday,
      });

      const line = await dataProvider.create("payroll_run_lines", {
        data: {
          payroll_run_id: payrollRunId,
          employee_id: person.id,
          compensation_type:
            compensation.unit === "day"
              ? "daily"
              : compensation.unit === "week"
                ? "weekly_salary"
                : compensation.unit === "month"
                  ? "monthly_salary"
                  : "hourly",
          compensation_unit: compensation.unit,
          compensation_amount: compensation.amount,
          payment_method: person.payment_method ?? "bank_deposit",
          regular_hours: regularHours || null,
          overtime_hours: overtimeHours || null,
          paid_leave_hours: paidLeaveHours || null,
          base_salary_amount: baseSalaryAmount || null,
          unpaid_absence_deduction: 0,
          loan_deductions: loanResult.totalLoanDeductions,
          other_deductions: 0,
          gross_pay: grossPay,
          total_deductions: loanResult.totalLoanDeductions,
          net_pay: loanResult.netPay,
          payment_reference: null,
          payment_notes: null,
        },
      });
      createdCount++;

      for (const loanDeduction of loanResult.deductions) {
        await dataProvider.create("employee_loan_deductions", {
          data: {
            loan_id: loanDeduction.loanId,
            payroll_run_id: payrollRunId,
            deduction_date: payrollRun.payday,
            scheduled_amount: loanDeduction.scheduledAmount,
            deducted_amount: loanDeduction.deductedAmount,
            remaining_balance_after: loanDeduction.remainingBalanceAfter,
            receipt_number: buildReceiptNumber("DEDUCT", payrollRun.payday),
            receipt_generated_at: new Date().toISOString(),
            notes: `Generated in payroll run #${payrollRunId}`,
          },
        });

        const nextStatus =
          loanDeduction.remainingBalanceAfter <= 0 ? "completed" : "active";
        await dataProvider.update("employee_loans", {
          id: loanDeduction.loanId,
          data: {
            remaining_balance: loanDeduction.remainingBalanceAfter,
            active: loanDeduction.remainingBalanceAfter > 0,
            paused: false,
            status: nextStatus,
            completed_at:
              loanDeduction.remainingBalanceAfter <= 0
                ? new Date().toISOString()
                : null,
            start_next_payroll: false,
          },
          previousData: personLoans.find(
            (loan) => loan.id === loanDeduction.loanId,
          ),
        });
      }

      for (const entry of personEntries) {
        await dataProvider.update("time_entries", {
          id: entry.id,
          data: {
            status: "included_in_payroll",
            included_in_payroll: true,
            payroll_run_id: payrollRunId,
          },
          previousData: entry,
        });
      }

      void line;
    }

    return createdCount;
  },
  releasePayrollRunLinkedResources: async (payrollRunId: Identifier) => {
    await releasePayrollRunResourcesOnCancel(dataProvider, payrollRunId);
  },
  stripeCreateCheckoutSession: async () => {
    throw new Error("Stripe billing is not available in demo mode");
  },
  stripeBillingPortal: async () => {
    throw new Error("Stripe billing is not available in demo mode");
  },
  stripeSyncSeats: async () => {
    throw new Error("Stripe billing is not available in demo mode");
  },
  getPlatformAuthUsers: async () => ({
    users: [],
    total: 0,
  }),
};

const roundMoney = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

/** Mirrors DB trigger: cancel payroll run releases hours and related rows (demo / FakeRest). */
const releasePayrollRunResourcesOnCancel = async (
  dp: CrmDataProvider,
  runId: Identifier,
) => {
  const { data: deductions } = await dp.getList<any>(
    "employee_loan_deductions",
    {
      filter: { payroll_run_id: runId },
      pagination: { page: 1, perPage: 10_000 },
      sort: { field: "id", order: "ASC" },
    },
  );

  for (const ded of deductions) {
    const { data: loan } = await dp.getOne<any>("employee_loans", {
      id: ded.loan_id,
    });
    if (loan) {
      const nextBalance = roundMoney(
        Number(loan.remaining_balance ?? 0) + Number(ded.deducted_amount ?? 0),
      );
      await dp.update("employee_loans", {
        id: loan.id,
        data: {
          remaining_balance: nextBalance,
          active: true,
          status: nextBalance > 0 ? "active" : (loan.status ?? "active"),
        },
        previousData: loan,
      });
    }
    await dp.delete("employee_loan_deductions", {
      id: ded.id,
      previousData: ded,
    });
  }

  const { data: entries } = await dp.getList<any>("time_entries", {
    filter: { payroll_run_id: runId },
    pagination: { page: 1, perPage: 10_000 },
    sort: { field: "id", order: "ASC" },
  });

  for (const entry of entries) {
    await dp.update("time_entries", {
      id: entry.id,
      data: {
        payroll_run_id: null,
        included_in_payroll: false,
        status:
          entry.status === "included_in_payroll" ? "approved" : entry.status,
      },
      previousData: entry,
    });
  }

  const { data: lines } = await dp.getList<any>("payroll_run_lines", {
    filter: { payroll_run_id: runId },
    pagination: { page: 1, perPage: 10_000 },
    sort: { field: "id", order: "ASC" },
  });

  for (const line of lines) {
    await dp.delete("payroll_run_lines", {
      id: line.id,
      previousData: line,
    });
  }

  const { data: payments } = await dp.getList<any>("payments", {
    filter: { payroll_run_id: runId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "DESC" },
  });

  for (const payment of payments) {
    await dp.update("payments", {
      id: payment.id,
      data: { payroll_run_id: null },
      previousData: payment,
    });
  }
};

async function updateCompany(
  companyId: Identifier,
  updateFn: (company: Company) => Partial<Company>,
) {
  const { data: company } = await dataProvider.getOne<Company>("companies", {
    id: companyId,
  });

  return await dataProvider.update("companies", {
    id: companyId,
    data: {
      ...updateFn(company),
    },
    previousData: company,
  });
}

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    return (await convertFileToBase64(logo)) as string;
  }
  return logo?.src ?? "";
};

const preserveAttachmentMimeType = <
  NoteType extends { attachments?: Array<{ rawFile?: File; type?: string }> },
>(
  note: NoteType,
): NoteType => ({
  ...note,
  attachments: (note.attachments ?? []).map((attachment) => ({
    ...attachment,
    type: attachment.type ?? attachment.rawFile?.type,
  })),
});

export const dataProvider = withLifecycleCallbacks(
  withSupabaseFilterAdapter(dataProviderWithCustomMethod),
  [
    {
      resource: "configuration",
      beforeUpdate: async (params) => {
        const config = params.data.config;
        if (config) {
          config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
          config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
        }
        return params;
      },
    },
    {
      resource: "sales",
      beforeGetList: async (params) => {
        return applyFullTextSearch(["first_name", "last_name", "email"], {
          useContactFtsColumns: false,
        })(params);
      },
      beforeCreate: async (params) => {
        const { data } = params;
        // If administrator role is not set, we simply set it to false
        if (data.administrator == null) {
          data.administrator = false;
        }
        data.roles = Array.isArray(data.roles)
          ? Array.from(new Set(data.roles))
          : data.administrator
            ? ["admin"]
            : [];
        data.email = normalizeEmailValue(data.email, "email") ?? "";
        return params;
      },
      beforeUpdate: async (params) => {
        params.data.email = normalizeEmailValue(params.data.email, "email");
        if (Array.isArray(params.data.roles)) {
          params.data.roles = Array.from(new Set(params.data.roles));
        }
        return params;
      },
      afterSave: async (data) => {
        // Since the current user is stored in localStorage in fakerest authProvider
        // we need to update it to keep information up to date in the UI
        const currentUser = await authProvider.getIdentity?.();
        if (currentUser?.id === data.id) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
        }
        return data;
      },
      beforeDelete: async (params) => {
        if (params.meta?.identity?.id == null) {
          throw new Error("Identity MUST be set in meta");
        }

        const newSaleId = params.meta.identity.id as Identifier;

        const [companies, contacts, contactNotes, deals] = await Promise.all([
          dataProvider.getList("companies", {
            filter: { sales_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
          dataProvider.getList("contacts", {
            filter: { sales_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
          dataProvider.getList("contact_notes", {
            filter: { sales_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
          dataProvider.getList("deals", {
            filter: { sales_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
        ]);

        await Promise.all([
          dataProvider.updateMany("companies", {
            ids: companies.data.map((company) => company.id),
            data: {
              sales_id: newSaleId,
            },
          }),
          dataProvider.updateMany("contacts", {
            ids: contacts.data.map((company) => company.id),
            data: {
              sales_id: newSaleId,
            },
          }),
          dataProvider.updateMany("contact_notes", {
            ids: contactNotes.data.map((company) => company.id),
            data: {
              sales_id: newSaleId,
            },
          }),
          dataProvider.updateMany("deals", {
            ids: deals.data.map((company) => company.id),
            data: {
              sales_id: newSaleId,
            },
          }),
        ]);

        return params;
      },
    } satisfies ResourceCallbacks<Sale>,
    {
      resource: "contacts",
      beforeCreate: async (createParams, dataProvider) => {
        const params = {
          ...createParams,
          data: {
            ...normalizeContactData(createParams.data),
            first_seen:
              createParams.data.first_seen ?? new Date().toISOString(),
            last_seen: createParams.data.last_seen ?? new Date().toISOString(),
          },
        };
        const newParams = await processContactAvatar(params);
        return fetchAndUpdateCompanyData(newParams, dataProvider);
      },
      afterCreate: async (result) => {
        if (result.data.company_id != null) {
          await updateCompany(result.data.company_id, (company) => ({
            nb_contacts: (company.nb_contacts ?? 0) + 1,
          }));
        }

        return result;
      },
      beforeUpdate: async (params) => {
        const newParams = await processContactAvatar({
          ...params,
          data: normalizeContactData(params.data),
        });
        return fetchAndUpdateCompanyData(newParams, dataProvider);
      },
      afterDelete: async (result) => {
        if (result.data.company_id != null) {
          await updateCompany(result.data.company_id, (company) => ({
            nb_contacts: (company.nb_contacts ?? 1) - 1,
          }));
        }

        return result;
      },
    } satisfies ResourceCallbacks<Contact>,
    {
      resource: "tasks",
      afterCreate: async (result, dataProvider) => {
        // update the task count in the related contact
        const { contact_id } = result.data;
        const { data: contact } = await dataProvider.getOne("contacts", {
          id: contact_id,
        });
        await dataProvider.update("contacts", {
          id: contact_id,
          data: {
            nb_tasks: (contact.nb_tasks ?? 0) + 1,
          },
          previousData: contact,
        });
        return result;
      },
      beforeUpdate: async (params) => {
        const { data, previousData } = params;
        if (previousData.done_date !== data.done_date) {
          taskUpdateType = data.done_date
            ? TASK_MARKED_AS_DONE
            : TASK_MARKED_AS_UNDONE;
        } else {
          taskUpdateType = TASK_DONE_NOT_CHANGED;
        }
        return params;
      },
      afterUpdate: async (result, dataProvider) => {
        // update the contact: if the task is done, decrement the nb tasks, otherwise increment it
        const { contact_id } = result.data;
        const { data: contact } = await dataProvider.getOne("contacts", {
          id: contact_id,
        });
        if (taskUpdateType !== TASK_DONE_NOT_CHANGED) {
          await dataProvider.update("contacts", {
            id: contact_id,
            data: {
              nb_tasks:
                taskUpdateType === TASK_MARKED_AS_DONE
                  ? (contact.nb_tasks ?? 0) - 1
                  : (contact.nb_tasks ?? 0) + 1,
            },
            previousData: contact,
          });
        }
        return result;
      },
      afterDelete: async (result, dataProvider) => {
        // update the task count in the related contact
        const { contact_id } = result.data;
        const { data: contact } = await dataProvider.getOne("contacts", {
          id: contact_id,
        });
        await dataProvider.update("contacts", {
          id: contact_id,
          data: {
            nb_tasks: (contact.nb_tasks ?? 0) - 1,
          },
          previousData: contact,
        });
        return result;
      },
    } satisfies ResourceCallbacks<Task>,
    {
      resource: "companies",
      beforeCreate: async (params) => {
        params.data.phone_number = normalizePhoneValue(
          params.data.phone_number,
        );
        const createParams = await processCompanyLogo(params);

        return {
          ...createParams,
          data: {
            ...createParams.data,
            created_at: new Date().toISOString(),
          },
        };
      },
      beforeUpdate: async (params) => {
        params.data.phone_number = normalizePhoneValue(
          params.data.phone_number,
        );
        return await processCompanyLogo(params);
      },
      afterUpdate: async (result, dataProvider) => {
        // get all contacts of the company and for each contact, update the company_name
        const { id, name } = result.data;
        const { data: contacts } = await dataProvider.getList("contacts", {
          filter: { company_id: id },
          pagination: { page: 1, perPage: 1000 },
          sort: { field: "id", order: "ASC" },
        });

        const contactIds = contacts.map((contact) => contact.id);
        await dataProvider.updateMany("contacts", {
          ids: contactIds,
          data: { company_name: name },
        });
        return result;
      },
    } satisfies ResourceCallbacks<Company>,
    {
      resource: "people",
      beforeCreate: async (params) => {
        params.data.email = normalizeEmailValue(params.data.email, "email");
        params.data.phone = normalizePhoneValue(params.data.phone);
        return params;
      },
      beforeUpdate: async (params) => {
        params.data.email = normalizeEmailValue(params.data.email, "email");
        params.data.phone = normalizePhoneValue(params.data.phone);
        return params;
      },
      beforeGetList: async (params) => {
        return applyFullTextSearch(
          ["first_name", "last_name", "email", "phone"],
          {
            useContactFtsColumns: false,
          },
        )(params);
      },
    },
    {
      resource: "employee_loans",
      beforeCreate: async (params) => {
        return {
          ...params,
          data: normalizeLoanPayload(params.data),
        };
      },
      beforeUpdate: async (params) => {
        return {
          ...params,
          data: normalizeLoanPayload(params.data),
        };
      },
    },
    {
      resource: "deals",
      beforeCreate: async (params) => {
        return {
          ...params,
          data: {
            ...params.data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };
      },
      afterCreate: async (result) => {
        await updateCompany(result.data.company_id, (company) => ({
          nb_deals: (company.nb_deals ?? 0) + 1,
        }));

        return result;
      },
      beforeUpdate: async (params) => {
        return {
          ...params,
          data: {
            ...params.data,
            updated_at: new Date().toISOString(),
          },
        };
      },
      afterDelete: async (result) => {
        await updateCompany(result.data.company_id, (company) => ({
          nb_deals: (company.nb_deals ?? 1) - 1,
        }));

        return result;
      },
    } satisfies ResourceCallbacks<Deal>,
    {
      resource: "contact_notes",
      beforeSave: async (params) => preserveAttachmentMimeType(params),
    } satisfies ResourceCallbacks<ContactNote>,
    {
      resource: "deal_notes",
      beforeSave: async (params) => preserveAttachmentMimeType(params),
    } satisfies ResourceCallbacks<DealNote>,
    {
      resource: "payroll_runs",
      beforeUpdate: async (params) => {
        const { data, previousData } = params;
        if (
          data.status === "cancelled" &&
          previousData &&
          previousData.status !== "cancelled"
        ) {
          return {
            ...params,
            data: { ...data, manual_deduction_total: null },
          };
        }
        return params;
      },
      afterUpdate: async (result, dp) => {
        const run = result.data as PayrollRun;
        if (run.status !== "cancelled") {
          return result;
        }

        const [
          { data: entrySample },
          { data: linesSample },
          { data: dedSample },
        ] = await Promise.all([
          dp.getList("time_entries", {
            filter: { payroll_run_id: run.id },
            pagination: { page: 1, perPage: 1 },
            sort: { field: "id", order: "ASC" },
          }),
          dp.getList("payroll_run_lines", {
            filter: { payroll_run_id: run.id },
            pagination: { page: 1, perPage: 1 },
            sort: { field: "id", order: "ASC" },
          }),
          dp.getList("employee_loan_deductions", {
            filter: { payroll_run_id: run.id },
            pagination: { page: 1, perPage: 1 },
            sort: { field: "id", order: "ASC" },
          }),
        ]);

        if (
          entrySample.length === 0 &&
          linesSample.length === 0 &&
          dedSample.length === 0
        ) {
          return result;
        }

        await releasePayrollRunResourcesOnCancel(dp, run.id);
        return result;
      },
    } satisfies ResourceCallbacks<PayrollRun>,
    {
      resource: "payments",
      afterUpdate: async (result, dp) => {
        const payment = result.data as {
          payroll_run_id?: number | string | null;
          status?: string;
          paid_at?: string | null;
        };
        if (!payment?.payroll_run_id) {
          return result;
        }
        const { data: run } = await dp.getOne<PayrollRun>("payroll_runs", {
          id: payment.payroll_run_id,
        });
        if (!run) {
          return result;
        }
        if (payment.status === "paid" && run.status !== "cancelled") {
          await dp.update("payroll_runs", {
            id: run.id,
            data: {
              status: "paid",
              paid_at: payment.paid_at ?? new Date().toISOString(),
            },
            previousData: run,
          });
        } else if (run.status === "paid" && payment.status !== "paid") {
          await dp.update("payroll_runs", {
            id: run.id,
            data: { status: "approved", paid_at: null },
            previousData: run,
          });
        }
        return result;
      },
    } satisfies ResourceCallbacks<Payment>,
  ],
) as CrmDataProvider;

/**
 * Convert a `File` object returned by the upload input into a base 64 string.
 * That's not the most optimized way to store images in production, but it's
 * enough to illustrate the idea of dataprovider decoration.
 */
const convertFileToBase64 = (file: { rawFile: Blob }): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    // We know result is a string as we used readAsDataURL
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file.rawFile);
  });

const applyFullTextSearch =
  (columns: string[], options: { useContactFtsColumns?: boolean } = {}) =>
  (params: any) => {
    if (!params.filter?.q) {
      return params;
    }
    const { useContactFtsColumns = true } = options;
    const { q, ...filter } = params.filter;
    return {
      ...params,
      filter: {
        ...filter,
        "@or": columns.reduce((acc, column) => {
          if (useContactFtsColumns && column === "email") {
            return {
              ...acc,
              [`email_fts@ilike`]: q,
            };
          }
          if (useContactFtsColumns && column === "phone") {
            return {
              ...acc,
              [`phone_fts@ilike`]: q,
            };
          }
          return {
            ...acc,
            [`${column}@ilike`]: q,
          };
        }, {}),
      },
    };
  };
