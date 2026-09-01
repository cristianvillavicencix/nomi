import type { ProposalLineDraft } from "@/modules/proposals/proposalCommercialUtils";

export const newLineKey = () => `line-${Date.now()}-${Math.random()}`;

/** Catalog line backed by service_packages (includes migrated legacy addon rows). */
export const isPackageLine = (line: ProposalLineDraft) =>
  line.package_id != null;

/** Legacy rows before catalog merge — still readable in cart. */
export const isLegacyAddonLine = (line: ProposalLineDraft) =>
  line.addon_id != null && line.package_id == null;

export const selectedPackageId = (lines: ProposalLineDraft[]) => {
  const oneTime = primaryOneTimePackageLine(lines);
  return oneTime?.package_id ?? null;
};

export const primaryOneTimePackageLine = (lines: ProposalLineDraft[]) =>
  lines.find(
    (line) =>
      line.billing_type !== "recurring" &&
      line.package_id != null &&
      line.addon_id == null,
  ) ??
  lines.find(
    (line) => line.billing_type !== "recurring" && line.package_id != null,
  ) ??
  null;

export const packageAlreadyInCart = (
  lines: ProposalLineDraft[],
  packageId: number,
) =>
  lines.some(
    (line) => line.package_id === packageId && line.addon_id == null,
  );

export const findPackageLine = (
  lines: ProposalLineDraft[],
  packageId: number,
) =>
  lines.find(
    (line) => line.package_id === packageId && line.addon_id == null,
  );

/** @deprecated Legacy add-on lines — prefer packageAlreadyInCart. */
export const addonAlreadyInCart = (
  lines: ProposalLineDraft[],
  addonId: number,
) => lines.some((line) => line.addon_id === addonId);

/** @deprecated Legacy add-on lines — prefer findPackageLine. */
export const findAddonLine = (lines: ProposalLineDraft[], addonId: number) =>
  lines.find((line) => line.addon_id === addonId);
