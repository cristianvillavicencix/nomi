import { buildProjectResourcesUrl } from "@/lbs/deals/projectResourceConstants";
import { PROJECT_RESOURCES_SLUG } from "@/lbs/deals/projectResourceConstants";
import { buildProjectWebFormUrl } from "@/lbs/deals/websiteIntakeForm";

export type WebFormShareParams = {
  dealId?: string | number | null;
  companyId?: string | number | null;
  contactId?: string | number | null;
};

export const isProjectScopedWebForm = (slug: string) =>
  slug === PROJECT_RESOURCES_SLUG;

export const getWebFormTypeLabel = (slug: string) => {
  if (slug === PROJECT_RESOURCES_SLUG) return "File upload";
  if (slug === "website-intake") return "Project brief";
  return "Custom";
};

export const buildWebFormShareUrl = (
  origin: string,
  slug: string,
  params: WebFormShareParams = {},
) => {
  if (slug === PROJECT_RESOURCES_SLUG) {
    if (params.dealId == null || String(params.dealId).trim() === "") {
      return "";
    }
    return buildProjectResourcesUrl(origin, {
      dealId: params.dealId,
      companyId: params.companyId,
      contactId: params.contactId,
    });
  }

  return buildProjectWebFormUrl(origin, {
    slug,
    dealId: params.dealId,
    companyId: params.companyId,
    contactId: params.contactId,
  });
};

export const buildWebFormPreviewUrl = (origin: string, slug: string) => {
  if (isProjectScopedWebForm(slug)) {
    return "";
  }
  return buildWebFormShareUrl(origin, slug, {});
};
