import { useParams } from "react-router";
import { isLikelyFormToken } from "@/modules/forms/formSchemaUtils";
import {
  PublicFormEmbedProvider,
  usePublicFormEmbed,
} from "@/modules/forms/public/PublicFormEmbedProvider";
import { PublicFormRenderer } from "@/modules/forms/public/PublicFormRenderer";
import { PublicFormSignedLinkRequired } from "@/modules/forms/public/PublicFormSignedLinkRequired";

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
