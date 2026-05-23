import { useState } from "react";
import { useNotify, useRefresh, useUpdate } from "ra-core";
import { ExternalLink, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { LbsDeal } from "@/lbs/types";

const COMMON_TECH = [
  "WordPress",
  "React",
  "Next.js",
  "Webflow",
  "Shopify",
  "Vite",
  "Tailwind",
];

const parseTechStack = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
};

export const ProjectDeploymentCard = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canEdit = useMemberCapability("crm.pipeline.edit");
  const [update] = useUpdate();
  const [draftTag, setDraftTag] = useState("");
  const techStack = parseTechStack(record.tech_stack);

  const saveFields = (patch: Partial<LbsDeal>) => {
    update(
      "deals",
      {
        id: record.id,
        data: patch,
        previousData: record,
      },
      {
        onSuccess: () => refresh(),
        onError: () => notify("Could not save project details", { type: "error" }),
      },
    );
  };

  const copyUrl = async (url?: string | null) => {
    if (!url?.trim()) return;
    await navigator.clipboard.writeText(url);
    notify("URL copied", { type: "info" });
  };

  const addTag = () => {
    const next = draftTag.trim();
    if (!next || techStack.includes(next)) return;
    saveFields({ tech_stack: [...techStack, next] });
    setDraftTag("");
  };

  const removeTag = (tag: string) => {
    saveFields({ tech_stack: techStack.filter((item) => item !== tag) });
  };

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="font-medium">Deployment</div>

      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Tech stack</div>
        <div className="flex flex-wrap gap-2">
          {techStack.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              {canEdit ? (
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => removeTag(tag)}
                >
                  ×
                </button>
              ) : null}
            </Badge>
          ))}
          {techStack.length === 0 ? (
            <span className="text-sm text-muted-foreground">No tags yet</span>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {COMMON_TECH.filter((tag) => !techStack.includes(tag))
              .slice(0, 4)
              .map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => saveFields({ tech_stack: [...techStack, tag] })}
                >
                  + {tag}
                </Button>
              ))}
            <Input
              className="max-w-[160px]"
              placeholder="Custom tag"
              value={draftTag}
              onChange={(event) => setDraftTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
            />
          </div>
        ) : null}
      </div>

      {(["staging_url", "production_url"] as const).map((field) => {
        const label = field === "staging_url" ? "Staging" : "Production";
        const value = record[field] ?? "";
        return (
          <div key={field} className="space-y-1">
            <div className="text-sm text-muted-foreground">{label}</div>
            {canEdit ? (
              <Input
                value={value}
                placeholder={`https://${field === "staging_url" ? "staging" : "www"}.example.com`}
                onChange={(event) =>
                  saveFields({ [field]: event.target.value || null })
                }
              />
            ) : (
              <div className="text-sm font-medium break-all">
                {value || "—"}
              </div>
            )}
            {value ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={value} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Visit
                  </a>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyUrl(value)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
