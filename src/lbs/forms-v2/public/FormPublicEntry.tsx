import { useParams } from "react-router";
import { isLikelyFormToken } from "@/lbs/forms-v2/formSchemaUtils";
import {
  PublicFormEmbedProvider,
  usePublicFormEmbed,
} from "@/lbs/forms-v2/public/PublicFormEmbedProvider";
import { PublicFormRenderer } from "@/lbs/forms-v2/public/PublicFormRenderer";
import { PublicFormSignedLinkRequired } from "@/lbs/forms-v2/public/PublicFormSignedLinkRequired";

const FormPublicEntryContent = () => {
  const { slug = "" } = useParams();
  const { embedded } = usePublicFormEmbed();
  const param = slug.trim();

  if (isLikelyFormToken(param)) {
    return <PublicFormRenderer />;
  }

  return <PublicFormSignedLinkRequired slug={param} embedded={embedded} />;
};

/** Routes v2 signed-token forms on `/forms/:tokenOrSlug`. */
export const FormPublicEntry = () => (
  <PublicFormEmbedProvider>
    <FormPublicEntryContent />
  </PublicFormEmbedProvider>
);
