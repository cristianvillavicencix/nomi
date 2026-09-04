import { createContext } from "react";
import type { BriefRequestScope } from "@/modules/deals/projectBriefRequestScope";

export type ProjectBriefActionsContextValue = {
  openRequestBrief: (scope?: BriefRequestScope) => void;
  openFillAllSections: () => void;
  openManualHandoff: () => void;
  exportBrief: () => void;
  isManualHandoffActive: boolean;
};

/** Stable module: keep createContext here so Vite HMR does not remount a second Context. */
export const ProjectBriefActionsContext =
  createContext<ProjectBriefActionsContextValue | null>(null);
