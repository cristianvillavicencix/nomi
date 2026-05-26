import { useWatch } from "react-hook-form";
import { useInput } from "ra-core";

import { AvatarPicker, type AvatarPickerValue } from "./AvatarPicker";
import type { AvatarBearingRecord } from "./resolveAvatar";

/**
 * Form-aware wrapper around AvatarPicker that binds to two sibling fields
 * (`avatar_type` and `avatar_url`) inside any react-admin / react-hook-form
 * `<Form>`. Drop it anywhere you'd put a `<TextInput>` and the value is
 * persisted on form submit alongside the rest of the record.
 */
export const AvatarPickerField = ({
  typeSource = "avatar_type",
  urlSource = "avatar_url",
  record,
  authUserId,
  folder,
  className,
}: {
  typeSource?: string;
  urlSource?: string;
  record?: AvatarBearingRecord | null;
  authUserId?: string | null;
  folder?: string;
  className?: string;
}) => {
  const typeInput = useInput({ source: typeSource });
  const urlInput = useInput({ source: urlSource });

  // Re-read via useWatch so the preview updates immediately on click.
  const currentType = useWatch({ name: typeSource });
  const currentUrl = useWatch({ name: urlSource });

  const value: AvatarPickerValue = {
    avatar_type: (currentType ?? typeInput.field.value ?? null) as
      | "peep"
      | "upload"
      | "default"
      | null,
    avatar_url: (currentUrl ?? urlInput.field.value ?? null) as string | null,
  };

  const handleChange = (next: AvatarPickerValue) => {
    typeInput.field.onChange(next.avatar_type);
    urlInput.field.onChange(next.avatar_url);
  };

  return (
    <AvatarPicker
      value={value}
      onChange={handleChange}
      record={record}
      authUserId={authUserId}
      folder={folder}
      className={className}
    />
  );
};
