import type { Deal } from "@/components/atomic-crm/types";
import { getCompanyAvatarFallback } from "@/components/atomic-crm/companies/CompanyAvatar";
import { lbsProjectTypeChoices } from "@/modules/deals/lbsProjectConstants";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryDate,
} from "@/modules/deals/projectDeliveryDate";

export const getDealCompanyLabel = (deal: Deal) => {
  const name = deal.company_name?.trim();
  if (name) return name;
  if (deal.company_id != null) return `Account #${deal.company_id}`;
  return "No company";
};

export const getDealProjectTypeLabel = (deal: Deal) => {
  const value = deal.project_type ?? deal.category;
  if (!value) return null;
  return (
    lbsProjectTypeChoices.find((choice) => choice.value === value)?.label ??
    value.replace(/-/g, " ")
  );
};

export const getDealCompanyInitials = (deal: Deal) =>
  getCompanyAvatarFallback({
    name: deal.company_name ?? undefined,
    company_name: deal.company_name ?? undefined,
  });

export const formatDealCardFooter = (deal: Deal) => {
  const deliveryDate = formatProjectDeliveryDate(getProjectDeliveryDate(deal));
  if (deliveryDate) return `Delivery ${deliveryDate}`;
  if (deal.updated_at) {
    const updated = new Date(deal.updated_at);
    if (!Number.isNaN(updated.getTime())) {
      return `Updated ${updated.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}`;
    }
  }
  return "Open project";
};
