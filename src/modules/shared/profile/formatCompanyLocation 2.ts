import {
  resolveCompanyAddressForDisplay,
  type CompanyAddressDisplaySource,
} from "@/modules/clients/clientAddressUtils";

/**
 * Complete company location for profile headers / previews.
 * Prefer structured address columns; falls back to raw address.
 */
export const formatCompanyLocation = (
  company: CompanyAddressDisplaySource,
): string => resolveCompanyAddressForDisplay(company);
