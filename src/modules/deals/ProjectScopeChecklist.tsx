import { useMemo, useState } from "react";
import { useInput } from "ra-core";
import { useWatch } from "react-hook-form";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_PAGES = [
  "Home",
  "About",
  "Services",
  "Contact",
  "Blog",
  "Gallery",
  "FAQ",
  "Online store",
];

const parseScope = (value?: string | null) => {
  if (!value?.trim()) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
};

const serializeScope = (pages: Set<string>) => Array.from(pages).join(", ");

export const ProjectScopeChecklist = () => {
  const { field } = useInput({ source: "website_brief.scope" });
  const scopeValue = useWatch({ name: "website_brief.scope" }) as
    | string
    | undefined;
  const selected = useMemo(
    () => parseScope(scopeValue ?? field.value),
    [field.value, scopeValue],
  );
  const [customDraft, setCustomDraft] = useState("");

  const customPages = useMemo(
    () =>
      Array.from(selected).filter(
        (page) =>
          !DEFAULT_PAGES.some(
            (item) => item.toLowerCase() === page.toLowerCase(),
          ),
      ),
    [selected],
  );

  const allPages = useMemo(() => {
    const merged = [...DEFAULT_PAGES];
    for (const page of customPages) {
      if (!merged.some((item) => item.toLowerCase() === page.toLowerCase())) {
        merged.push(page);
      }
    }
    return merged;
  }, [customPages]);

  const updateScope = (next: Set<string>) => {
    field.onChange(serializeScope(next));
  };

  const togglePage = (page: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      next.add(page);
    } else {
      next.delete(page);
    }
    updateScope(next);
  };

  const addCustomPage = () => {
    const trimmed = customDraft.trim();
    if (!trimmed) return;
    const next = new Set(selected);
    next.add(trimmed);
    updateScope(next);
    setCustomDraft("");
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <Label>Pages & scope</Label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {allPages.map((page) => {
          const checked = selected.has(page);
          return (
            <label
              key={page}
              className="flex cursor-pointer items-center gap-2 rounded-md py-1 text-sm"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => togglePage(page, value === true)}
              />
              <span>{page}</span>
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={customDraft}
          onChange={(event) => setCustomDraft(event.target.value)}
          placeholder="Add a custom page"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomPage();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addCustomPage}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  );
};
