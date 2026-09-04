import type { FormFieldDef, FormSchemaV2 } from "@/modules/forms/types";
import { PROJECT_RESOURCES_UPLOAD_LIMITS } from "@/modules/deals/projectResourcesUploadLimits";

const applyFieldLimit = (
  field: FormFieldDef,
  patch: Partial<FormFieldDef>,
): FormFieldDef => ({ ...field, ...patch });

/** Clamp project-resources upload fields to product caps (schema may lag migrations). */
export const applyProjectResourcesUploadLimits = (
  schema: FormSchemaV2 | undefined,
): FormSchemaV2 | undefined => {
  if (!schema?.sections?.length) return schema;

  return {
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      fields: (section.fields ?? []).map((field) => {
        if (field.key === "logos" && field.type === "file_multi") {
          return applyFieldLimit(field, {
            max_files: PROJECT_RESOURCES_UPLOAD_LIMITS.logos,
            soft_warn_after: PROJECT_RESOURCES_UPLOAD_LIMITS.logos,
          });
        }
        if (field.key === "team_photos" && field.type === "file_multi") {
          return applyFieldLimit(field, {
            max_files: PROJECT_RESOURCES_UPLOAD_LIMITS.teamPhotos,
            help_text:
              field.help_text ??
              "For each person, add a photo plus their name and role at the company.",
          });
        }
        if (
          field.key === "service_photos" &&
          field.type === "dynamic_file_groups"
        ) {
          return applyFieldLimit(field, {
            max_files_per_group:
              PROJECT_RESOURCES_UPLOAD_LIMITS.servicePhotosPerService,
          });
        }
        if (
          field.key === "before_after_photos" &&
          field.type === "before_after_photos"
        ) {
          return applyFieldLimit(field, {
            max_files_per_group:
              PROJECT_RESOURCES_UPLOAD_LIMITS.beforeAfterPairsPerService,
          });
        }
        return field;
      }),
    })),
  };
};
