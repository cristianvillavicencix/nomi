import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const TagBadges = ({
  tags,
  className,
}: {
  tags?: string[] | null;
  className?: string;
}) => {
  if (!tags?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="rounded-full capitalize">
          {tag}
        </Badge>
      ))}
    </div>
  );
};

export const TagInput = ({
  tags,
  onChange,
  disabled,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) => {
  const addTag = (raw: string) => {
    const next = raw.trim().toLowerCase();
    if (!next || tags.includes(next)) return;
    onChange([...tags, next]);
  };

  return (
    <div className="space-y-2">
      <TagBadges tags={tags} />
      <input
        type="text"
        disabled={disabled}
        placeholder="Add tag and press Enter"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          addTag((event.target as HTMLInputElement).value);
          (event.target as HTMLInputElement).value = "";
        }}
      />
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs capitalize"
              onClick={() => onChange(tags.filter((entry) => entry !== tag))}
            >
              {tag}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
