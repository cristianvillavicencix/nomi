import { useWatch } from "react-hook-form";
import { useRecordContext } from "ra-core";
import { getLbsProjectScopeMode } from "@/modules/deals/lbsProjectConstants";
import { ProjectScopeChecklist } from "@/modules/deals/ProjectScopeChecklist";
import { usesContractorBriefForm } from "@/modules/deals/contractorBriefSchema";
import { ContractorBriefInternalSection } from "@/modules/deals/contractorBrief/ContractorBriefInternalSection";
import { getVisibleBriefSections } from "@/modules/deals/websiteBriefSchema";
import { evaluateCondition } from "@/lib/forms-v2/conditionalLogic";
import type { LbsDeal } from "@/modules/types";
import {
  BriefFieldInput,
  BriefSectionShell,
} from "@/modules/deals/WebsiteBriefFormSections.shared";

const CONTRACTOR_RICH_SECTIONS = new Set([
  "about_business",
  "services",
  "contact_preferences",
  "visual_content",
  "brand_style",
]);

type WebsiteBriefFormSectionsProps = {
  gridClass?: string;
  projectTypeSource?: string;
  excludeFieldKeys?: string[];
  onlySectionId?: string;
  showScopeChecklist?: boolean;
  showSecurityHint?: boolean;
  validateUrl?: (url?: string) => string | undefined;
};

export const WebsiteBriefFormSections = ({
  gridClass = "grid gap-4 md:grid-cols-2",
  projectTypeSource = "project_type",
  excludeFieldKeys = [],
  onlySectionId,
  showScopeChecklist = true,
  showSecurityHint = true,
  validateUrl,
}: WebsiteBriefFormSectionsProps) => {
  const record = useRecordContext<LbsDeal>();
  const projectType = useWatch({ name: projectTypeSource }) as
    | string
    | undefined;
  const briefAnswers =
    (useWatch({ name: "website_brief" }) as Record<string, unknown>) ?? {};
  const sections = getVisibleBriefSections(projectType).filter(
    (section) => !onlySectionId || section.id === onlySectionId,
  );
  const scopeMode = getLbsProjectScopeMode(projectType);
  const excluded = new Set(excludeFieldKeys);
  const hideSectionHeader = Boolean(onlySectionId);
  const isContractorBrief = usesContractorBriefForm(projectType);

  return (
    <div className="space-y-2">
      {sections.map((section, index) => {
        const fields = section.fields
          .filter((field) => !excluded.has(field.key))
          .filter((field) =>
            evaluateCondition(field.visibleWhen, briefAnswers),
          );
        const usesRichSection =
          isContractorBrief &&
          CONTRACTOR_RICH_SECTIONS.has(section.id) &&
          record?.id != null;

        if (
          fields.length === 0 &&
          !usesRichSection &&
          !(section.id === "scope" && showScopeChecklist)
        ) {
          return null;
        }

        return (
          <BriefSectionShell
            key={section.id}
            title={section.title}
            description={section.description}
            showDivider={index > 0}
            hideHeader={hideSectionHeader}
          >
            {usesRichSection ? (
              <ContractorBriefInternalSection
                section={section}
                dealId={record.id}
                gridClass={gridClass}
                validateUrl={validateUrl}
              />
            ) : (
              <div className={gridClass}>
                {section.id === "scope" &&
                showScopeChecklist &&
                scopeMode === "pages" ? (
                  <div className="md:col-span-2">
                    <ProjectScopeChecklist />
                  </div>
                ) : null}
                {fields.map((field) => (
                  <BriefFieldInput
                    key={field.key}
                    field={field}
                    gridClass={gridClass}
                    validateUrl={validateUrl}
                  />
                ))}
              </div>
            )}
          </BriefSectionShell>
        );
      })}

      {showSecurityHint && !isContractorBrief ? (
        <p className="text-sm text-muted-foreground">
          Store hosting, WordPress, FTP, and other logins in the{" "}
          <span className="font-medium text-foreground">Security</span> tab.
          Upload logos and photos in{" "}
          <span className="font-medium text-foreground">Resources</span>.
        </p>
      ) : null}
    </div>
  );
};
