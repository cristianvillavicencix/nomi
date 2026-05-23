import { useState } from "react";
import { useGetIdentity, useNotify, useRefresh, useUpdate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  approveContentPage,
  parseWebsiteContent,
  requestContentRevision,
  type WebsiteContentPage,
} from "@/lbs/projects/websiteContentSchema";
import type { LbsDeal } from "@/lbs/types";

export const ProjectContentTab = ({ record }: { record: LbsDeal }) => {
  const content = parseWebsiteContent(record.website_content);
  const [activeId, setActiveId] = useState(content.pages?.[0]?.id ?? "home");
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();

  const activePage =
    content.pages?.find((p) => p.id === activeId) ?? content.pages?.[0];
  if (!activePage) return null;

  const savePage = (patch: Partial<WebsiteContentPage>) => {
    const nextPages = (content.pages ?? []).map((p) =>
      p.id === activePage.id ? { ...p, ...patch } : p,
    );
    update(
      "deals",
      {
        id: record.id,
        data: { website_content: { pages: nextPages } },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("Content saved", { type: "info" });
          refresh();
        },
        onError: () => notify("Could not save content", { type: "error" }),
      },
    );
  };

  const approve = () => {
    const memberId = identity?.id ? Number(identity.id) : null;
    update(
      "deals",
      {
        id: record.id,
        data: {
          website_content: approveContentPage(content, activePage.id, memberId),
        },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("Page approved", { type: "info" });
          refresh();
        },
      },
    );
  };

  const requestRevision = () => {
    const notes = window.prompt("Revision notes for the client/team:");
    if (!notes?.trim()) return;
    update(
      "deals",
      {
        id: record.id,
        data: {
          website_content: requestContentRevision(
            content,
            activePage.id,
            notes.trim(),
          ),
        },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("Revision requested", { type: "info" });
          refresh();
        },
      },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="flex flex-col gap-1">
        {(content.pages ?? []).map((page) => (
          <Button
            key={page.id}
            type="button"
            variant={page.id === activeId ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setActiveId(page.id)}
          >
            {page.title}
            {page.status === "approved" ? (
              <Badge variant="outline" className="ml-auto text-xs">
                OK
              </Badge>
            ) : null}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{activePage.title}</CardTitle>
          <Badge variant="outline" className="capitalize">
            {(activePage.status ?? "draft").replace(/_/g, " ")}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">SEO title</label>
              <Input
                defaultValue={activePage.seo_title ?? ""}
                onBlur={(e) => savePage({ seo_title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target keyword</label>
              <Input
                defaultValue={activePage.target_keyword ?? ""}
                onBlur={(e) => savePage({ target_keyword: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Meta description</label>
            <Textarea
              rows={2}
              defaultValue={activePage.meta_description ?? ""}
              onBlur={(e) => savePage({ meta_description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Page content (client-facing draft)
            </label>
            <Textarea
              rows={6}
              defaultValue={activePage.client_text ?? ""}
              onBlur={(e) => savePage({ client_text: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">CTA</label>
            <Input
              defaultValue={activePage.cta ?? ""}
              onBlur={(e) => savePage({ cta: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={approve}>
              Approve page
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={requestRevision}
            >
              Request revision
            </Button>
          </div>
          {activePage.approval?.revision_notes ? (
            <p className="text-sm text-amber-700">
              {activePage.approval.revision_notes}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
