import { Link2 } from "lucide-react";
import {
  publicFormContentClassName,
  usePublicFormEmbed,
} from "@/lbs/web-forms/PublicFormEmbedProvider";

type PublicFormSignedLinkRequiredProps = {
  slug?: string;
};

export const PublicFormSignedLinkRequired = ({
  slug,
}: PublicFormSignedLinkRequiredProps) => {
  const { embedded } = usePublicFormEmbed();

  return (
    <div className={publicFormContentClassName(embedded) + " text-center"}>
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
        <Link2 className="size-5 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-xl font-semibold">Form link required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This URL is not a valid public form link. Forms are shared using signed
        links generated from the CRM (Preview, Copy public link, or Send form).
      </p>
      {slug ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">{slug}</p>
      ) : null}
    </div>
  );
};
