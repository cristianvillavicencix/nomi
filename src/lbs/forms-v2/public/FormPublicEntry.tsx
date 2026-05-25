import { useParams } from "react-router";
import { PROJECT_RESOURCES_SLUG } from "@/lbs/deals/projectResourceConstants";
import { WEBSITE_INTAKE_SLUG } from "@/lbs/deals/websiteBriefSchema";
import { isLikelyFormToken } from "@/lbs/forms-v2/formSchemaUtils";
import { PublicFormRenderer } from "@/lbs/forms-v2/public/PublicFormRenderer";
import { PublicFormSignedLinkRequired } from "@/lbs/forms-v2/public/PublicFormSignedLinkRequired";
import { PublicFormPage } from "@/lbs/web-forms/PublicFormPage";

const LEGACY_PUBLIC_FORM_SLUGS = new Set([
  WEBSITE_INTAKE_SLUG,
  PROJECT_RESOURCES_SLUG,
]);

/** Routes legacy slug forms vs v2 signed-token forms on `/forms/:tokenOrSlug`. */
export const FormPublicEntry = () => {
  const { slug = "" } = useParams();
  const param = slug.trim();

  if (isLikelyFormToken(param)) {
    return <PublicFormRenderer />;
  }

  if (LEGACY_PUBLIC_FORM_SLUGS.has(param)) {
    return <PublicFormPage />;
  }

  // v2 forms are token-only; slug URLs must not hit deprecated get_public_form.
  return <PublicFormSignedLinkRequired slug={param} />;
};
