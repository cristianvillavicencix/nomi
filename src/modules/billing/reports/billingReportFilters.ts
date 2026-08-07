import type { Company, Contact } from "@/components/atomic-crm/types";
import { formatContactName } from "@/modules/billing/billingUtils";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";

export type BillingReportCustomerFilter = {
  type: "company" | "contact";
  id: string;
};

export type BillingReportFilters = {
  customer?: BillingReportCustomerFilter;
  product?: string;
};

export type BillingReportCustomerOption = {
  value: string;
  label: string;
  type: "company" | "contact";
  id: string;
};

const normalizeProduct = (value: string) => value.trim().toLowerCase();

export const invoiceProductLabel = (invoice: ClientInvoice) =>
  invoice.description?.trim() ||
  invoice.reference?.trim() ||
  `Invoice #${invoice.id}`;

const extractSubscriptionLineDescriptions = (
  subscription: ClientSubscription,
) => {
  if (!Array.isArray(subscription.line_items)) {
    return subscription.name?.trim() ? [subscription.name.trim()] : [];
  }
  return subscription.line_items
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const record = row as Record<string, unknown>;
      return String(record.description ?? subscription.name ?? "Item").trim();
    })
    .filter(Boolean);
};

export const subscriptionProductLabels = (subscription: ClientSubscription) => {
  const labels = extractSubscriptionLineDescriptions(subscription);
  if (labels.length > 0) return labels;
  return subscription.name?.trim() ? [subscription.name.trim()] : [];
};

export const invoiceMatchesProductFilter = (
  invoice: ClientInvoice,
  product: string,
) => {
  const needle = normalizeProduct(product);
  if (!needle) return true;
  const haystack = [
    invoice.description,
    invoice.reference,
    invoiceProductLabel(invoice),
  ]
    .filter(Boolean)
    .map((value) => normalizeProduct(String(value)));
  return haystack.some(
    (value) => value === needle || value.includes(needle) || needle.includes(value),
  );
};

export const subscriptionMatchesProductFilter = (
  subscription: ClientSubscription,
  product: string,
) => {
  const needle = normalizeProduct(product);
  if (!needle) return true;
  return subscriptionProductLabels(subscription).some((label) => {
    const normalized = normalizeProduct(label);
    return (
      normalized === needle ||
      normalized.includes(needle) ||
      needle.includes(normalized)
    );
  });
};

export const invoiceMatchesCustomerFilter = (
  invoice: ClientInvoice,
  customer: BillingReportCustomerFilter,
) => {
  if (customer.type === "company") {
    return String(invoice.company_id ?? "") === customer.id;
  }
  return String(invoice.contact_id ?? "") === customer.id;
};

export const subscriptionMatchesCustomerFilter = (
  subscription: ClientSubscription,
  customer: BillingReportCustomerFilter,
) => {
  if (customer.type === "company") {
    return String(subscription.company_id ?? "") === customer.id;
  }
  return String(subscription.contact_id ?? "") === customer.id;
};

export const filterInvoicesForReport = (
  invoices: ClientInvoice[],
  filters: BillingReportFilters,
) =>
  invoices.filter((invoice) => {
    if (
      filters.customer &&
      !invoiceMatchesCustomerFilter(invoice, filters.customer)
    ) {
      return false;
    }
    if (
      filters.product &&
      !invoiceMatchesProductFilter(invoice, filters.product)
    ) {
      return false;
    }
    return true;
  });

export const filterSubscriptionsForReport = (
  subscriptions: ClientSubscription[],
  filters: BillingReportFilters,
) =>
  subscriptions.filter((subscription) => {
    if (
      filters.customer &&
      !subscriptionMatchesCustomerFilter(subscription, filters.customer)
    ) {
      return false;
    }
    if (
      filters.product &&
      !subscriptionMatchesProductFilter(subscription, filters.product)
    ) {
      return false;
    }
    return true;
  });

export const extractReportProductOptions = (
  invoices: ClientInvoice[],
  subscriptions: ClientSubscription[],
) => {
  const names = new Map<string, string>();
  for (const invoice of invoices) {
    const label = invoiceProductLabel(invoice);
    const key = normalizeProduct(label);
    if (key) names.set(key, label);
  }
  for (const subscription of subscriptions) {
    for (const label of subscriptionProductLabels(subscription)) {
      const key = normalizeProduct(label);
      if (key) names.set(key, label);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
};

export const extractReportCustomerOptions = (
  invoices: ClientInvoice[],
  subscriptions: ClientSubscription[],
  companyById: Map<string, Company>,
  contactById: Map<string, Contact>,
): BillingReportCustomerOption[] => {
  const options = new Map<string, BillingReportCustomerOption>();

  const addCompany = (companyId: unknown) => {
    if (companyId == null) return;
    const id = String(companyId);
    const company = companyById.get(id);
    const label = company?.name?.trim() || `Company #${id}`;
    options.set(`company:${id}`, {
      value: `company:${id}`,
      label,
      type: "company",
      id,
    });
  };

  const addContact = (contactId: unknown) => {
    if (contactId == null) return;
    const id = String(contactId);
    const contact = contactById.get(id);
    const label = formatContactName(contact) || `Contact #${id}`;
    options.set(`contact:${id}`, {
      value: `contact:${id}`,
      label,
      type: "contact",
      id,
    });
  };

  for (const invoice of invoices) {
    addCompany(invoice.company_id);
    addContact(invoice.contact_id);
  }
  for (const subscription of subscriptions) {
    addCompany(subscription.company_id);
    addContact(subscription.contact_id);
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
};

export const formatBillingReportCustomerParam = (
  customer: BillingReportCustomerFilter,
) => `${customer.type}:${customer.id}`;

export const parseBillingReportCustomerParam = (
  value: string | null,
): BillingReportCustomerFilter | undefined => {
  if (!value?.trim()) return undefined;
  const [type, ...rest] = value.split(":");
  const id = rest.join(":");
  if ((type === "company" || type === "contact") && id) {
    return { type, id };
  }
  return undefined;
};

export const hasActiveBillingReportFilters = (filters: BillingReportFilters) =>
  Boolean(filters.customer || filters.product?.trim());
