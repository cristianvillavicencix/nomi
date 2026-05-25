import { useParams } from "react-router";
import { isLikelyFormToken } from "@/lbs/forms-v2/formSchemaUtils";
import { PublicFormRenderer } from "@/lbs/forms-v2/public/PublicFormRenderer";
import { PublicFormPage } from "@/lbs/web-forms/PublicFormPage";

/** Routes legacy slug forms vs v2 signed-token forms on `/forms/:tokenOrSlug`. */
export const FormPublicEntry = () => {
  const { slug = "", token = "" } = useParams();
  const param = (token || slug).trim();

  if (isLikelyFormToken(param)) {
    return <PublicFormRenderer />;
  }

  return <PublicFormPage />;
};
