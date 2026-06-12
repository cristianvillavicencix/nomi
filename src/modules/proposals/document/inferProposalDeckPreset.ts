import type { ProposalDeckPresetId } from "@/modules/proposals/document/proposalDeckSectionOrder";

type LineForPreset = {
  package_id?: number | null;
  addon_id?: number | null;
  description?: string;
};

type PackageForPreset = {
  category?: string | null;
  name?: string | null;
};

const descriptionHints = (description: string): ProposalDeckPresetId | null => {
  const d = description.toLowerCase();
  if (d.includes("skop")) return "skop";
  if (d.includes("redesign")) return "website-redesign";
  if (d.includes("marketing") || d.includes("ads")) return "digital-marketing";
  return null;
};

/** Map builder cart (package line) → formal proposal deck preset. */
export const inferProposalDeckPresetFromLines = (
  lines: LineForPreset[],
  packagesById?: Map<number, PackageForPreset>,
): ProposalDeckPresetId => {
  const packageLine = lines.find(
    (line) => line.package_id != null && line.addon_id == null,
  );

  if (!packageLine?.package_id) {
    return "website-contractor";
  }

  const pkg = packagesById?.get(Number(packageLine.package_id));
  if (pkg) {
    const category = pkg.category?.toLowerCase() ?? "";
    const name = pkg.name?.toLowerCase() ?? "";
    if (category === "skop" || name.includes("skop")) return "skop";
    if (category === "marketing") return "digital-marketing";
    if (name.includes("redesign")) return "website-redesign";
    if (category === "web") return "website-contractor";
  }

  const fromDescription = descriptionHints(packageLine.description ?? "");
  if (fromDescription) return fromDescription;

  return "website-contractor";
};
