import type { ProposalLineDraft } from "@/lbs/proposals/proposalCommercialUtils";

export const newLineKey = () => `line-${Date.now()}-${Math.random()}`;

export const isPackageLine = (line: ProposalLineDraft) =>
  line.package_id != null && line.addon_id == null;

export const isAddonLine = (line: ProposalLineDraft) => line.addon_id != null;

export const selectedPackageId = (lines: ProposalLineDraft[]) => {
  const pkgLine = lines.find(isPackageLine);
  return pkgLine?.package_id ?? null;
};

export const addonAlreadyInCart = (
  lines: ProposalLineDraft[],
  addonId: number,
) => lines.some((line) => line.addon_id === addonId);
