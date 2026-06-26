import { Plus, X as XIcon } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBriefSocialDisplay,
  parseBriefSocialUrls,
  serializeBriefSocialUrls,
} from "@/modules/deals/briefSocialLinks";
import type { WebsiteBriefFieldDef } from "@/modules/deals/websiteBriefSchema";

export const BriefSocialLinksInput = ({
  field,
}: {
  field: WebsiteBriefFieldDef;
}) => {
  const { setValue } = useFormContext();
  const source = `website_brief.${field.key}`;
  const stored = useWatch({ name: source }) as string[] | undefined;
  const urls = parseBriefSocialUrls(stored);

  const commitUrls = (next: string[]) => {
    setValue(source, serializeBriefSocialUrls(next), {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const updateUrl = (index: number, url: string) => {
    commitUrls(urls.map((row, rowIndex) => (rowIndex === index ? url : row)));
  };

  const appendRow = () => {
    commitUrls([...urls, ""]);
  };

  const removeRow = (index: number) => {
    const next = urls.filter((_, rowIndex) => rowIndex !== index);
    commitUrls(next.length > 0 ? next : [""]);
  };

  return (
    <div className="md:col-span-2 space-y-2">
      <div className="text-sm font-medium">{field.label}</div>
      {field.helperText ? (
        <p className="text-muted-foreground text-xs">{field.helperText}</p>
      ) : null}
      <ul className="space-y-2">
        {urls.map((url, index) => {
          const { label, Icon } = getBriefSocialDisplay(url);
          const isLast = index === urls.length - 1;
          const showDetected = Boolean(url.trim());

          return (
            <li key={`social-${index}`} className="flex items-center gap-2">
              <div className="flex w-[5.5rem] shrink-0 items-center gap-1.5">
                <Icon className="text-muted-foreground size-4 shrink-0" />
                {showDetected ? (
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                ) : null}
              </div>
              <Input
                value={url}
                placeholder={field.placeholder ?? "instagram.com/yourcompany"}
                className="min-w-0 flex-1"
                onChange={(event) => updateUrl(index, event.target.value)}
              />
              {isLast ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Add social profile"
                  onClick={appendRow}
                  className="size-8 shrink-0"
                >
                  <Plus className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Insert below"
                  onClick={() => {
                    const next = [...urls];
                    next.splice(index + 1, 0, "");
                    commitUrls(next);
                  }}
                  className="size-8 shrink-0"
                >
                  <Plus className="size-4" />
                </Button>
              )}
              {urls.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove social profile"
                  onClick={() => removeRow(index)}
                  className="size-8 shrink-0"
                >
                  <XIcon className="size-4" />
                </Button>
              ) : (
                <div aria-hidden className="size-8 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
