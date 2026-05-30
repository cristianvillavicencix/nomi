import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  label?: string;
};

const ACTION_SLOT = "size-8 shrink-0";
const ACTION_COL = "flex h-9 w-[4.5rem] shrink-0 items-center justify-end gap-0.5";

export const ClientSocialLinksInput = ({
  source,
  label = "Social media",
}: ClientSocialLinksInputProps) => {
  const { control } = useFormContext<ClientCreateFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: source,
  });

  const appendLink = () => append({ url: "" } satisfies ClientSocialLinkValue);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-end gap-2">
        <p className="text-sm font-medium">{label}</p>
        <span className="sr-only">Actions</span>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <SocialLinkRow
            key={field.id}
            source={source}
            index={index}
            canRemove={fields.length > 1}
            showAdd={index === fields.length - 1}
            onAdd={appendLink}
            onRemove={() => remove(index)}
          />
        ))}
      </div>
    </div>
  );
};

const SocialLinkRow = ({
  source,
  index,
  canRemove,
  showAdd,
  onAdd,
  onRemove,
}: {
  source: SocialLinksSource;
  index: number;
  canRemove: boolean;
  showAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) => {
  const url = useWatch<ClientCreateFormValues>({
    name: `${source}.${index}.url`,
  }) as string | undefined;
  const { Icon } = getSocialNetworkOption(detectSocialNetworkFromUrl(url));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-5 shrink-0 items-center justify-center">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <TextInput
            source={`${source}.${index}.url`}
            label={false}
            helperText={false}
            validate={optionalUrl}
            placeholder="https://linkedin.com/..."
            className="gap-0"
          />
        </div>
      </div>
      <div className={ACTION_COL}>
        {showAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(ACTION_SLOT, "text-muted-foreground")}
            onClick={onAdd}
            aria-label="Add social media"
            title="Add social media"
          >
            <Plus className="size-4" />
          </Button>
        ) : (
          <div aria-hidden className={ACTION_SLOT} />
        )}
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              ACTION_SLOT,
              "text-muted-foreground hover:text-destructive",
            )}
            onClick={onRemove}
            aria-label="Remove social media"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <div aria-hidden className={ACTION_SLOT} />
        )}
      </div>
    </div>
  );
};
