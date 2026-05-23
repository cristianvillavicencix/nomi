import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import { getLbsProjectScopeMode } from "@/lbs/deals/lbsProjectConstants";
import { ProjectScopeChecklist } from "@/lbs/deals/ProjectScopeChecklist";
import {
  getVisibleBriefSections,
  type WebsiteBriefFieldDef,
} from "@/lbs/deals/websiteBriefSchema";

const BriefSectionShell = ({
  title,
  description,
  children,
  showDivider = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  showDivider?: boolean;
}) => (
  <>
    {showDivider ? (
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-border/80 to-transparent"
        aria-hidden
      />
    ) : null}
    <section className="space-y-4 py-1">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  </>
);

const BriefFieldInput = ({
  field,
  gridClass,
  validateUrl,
}: {
  field: WebsiteBriefFieldDef;
  gridClass: string;
  validateUrl?: (url?: string) => string | undefined;
}) => {
  const source = `website_brief.${field.key}`;
  const isUrlField =
    field.key === "existing_website" || field.key === "staging_url";

  return (
    <div
      className={
        field.fullWidth
          ? gridClass.includes("1")
            ? undefined
            : "md:col-span-2"
          : undefined
      }
    >
      <TextInput
        source={source}
        label={field.label}
        placeholder={field.placeholder}
        helperText={field.helperText ?? false}
        multiline={field.multiline}
        rows={field.rows ?? 3}
        validate={isUrlField && validateUrl ? validateUrl : undefined}
      />
    </div>
  );
};

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
  const projectType = useWatch({ name: projectTypeSource }) as
    | string
    | undefined;
  const sections = getVisibleBriefSections(projectType).filter(
    (section) => !onlySectionId || section.id === onlySectionId,
  );
  const scopeMode = getLbsProjectScopeMode(projectType);
  const excluded = new Set(excludeFieldKeys);

  return (
    <div className="space-y-2">
      {sections.map((section, index) => {
        const fields = section.fields.filter(
          (field) => !excluded.has(field.key),
        );
        if (
          fields.length === 0 &&
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
          >
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
          </BriefSectionShell>
        );
      })}

      {showSecurityHint ? (
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
