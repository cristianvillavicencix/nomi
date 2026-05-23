import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import {
  detectSocialNetworkFromUrl,
  getSocialNetworkOption,
  type ClientSocialLinkValue,
} from "@/lbs/clients/clientSocialLinks";

const optionalUrl = (url?: string) => {
  if (!url?.trim()) return;
  const urlRegex =
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?$/i;
  if (!urlRegex.test(url.trim())) {
    return "Must be a valid URL";
  }
};

type SocialLinksSource = "social_links";

type ClientSocialLinksInputProps = {
  source: SocialLinksSource;
  label: string;
};

export const ClientSocialLinksInput = ({
  source,
  label,
}: ClientSocialLinksInputProps) => {
  const { control } = useFormContext<ClientCreateFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: source,
  });

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <SocialLinkRow
          key={field.id}
          source={source}
          index={index}
          label={index === 0 ? label : false}
          canRemove={fields.length > 1}
          onRemove={() => remove(index)}
        />
      ))}
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-muted-foreground"
        onClick={() => append({ url: "" } satisfies ClientSocialLinkValue)}
      >
        <Plus className="size-4" />
        Add another link
      </Button>
    </div>
  );
};

const SocialLinkRow = ({
  source,
  index,
  label,
  canRemove,
  onRemove,
}: {
  source: SocialLinksSource;
  index: number;
  label: string | false;
  canRemove: boolean;
  onRemove: () => void;
}) => {
  const url = useWatch<ClientCreateFormValues>({
    name: `${source}.${index}.url`,
  }) as string | undefined;
  const { Icon } = getSocialNetworkOption(detectSocialNetworkFromUrl(url));

  return (
    <div className="flex items-end gap-2">
      <Icon className="mb-2.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <TextInput
          source={`${source}.${index}.url`}
          label={label || false}
          helperText={false}
          validate={optionalUrl}
          placeholder="https://linkedin.com/..."
        />
      </div>
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-0.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove link"
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <div className="size-8 shrink-0" />
      )}
    </div>
  );
};
