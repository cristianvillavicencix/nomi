import { useMemo, useState } from "react";
import {
  useCreate,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type {
  DealLaunchChecklistItem,
  LbsDeal,
} from "@/lbs/types";
import {
  generateLaunchChecklistFromTemplate,
  getLaunchChecklistCategoryLabel,
  getLaunchChecklistProgress,
  LAUNCH_CHECKLIST_CATEGORIES,
} from "@/lbs/projects/launch/launchChecklistUtils";

export const LaunchChecklistTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const { data: identity } = useGetIdentity();
  const canEdit = useMemberCapability("crm.pipeline.edit");
  const [generating, setGenerating] = useState(false);

  const { data: items = [], isPending } = useGetList<DealLaunchChecklistItem>(
    "deal_launch_checklist_items",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "order_index", order: "ASC" },
    },
  );

  const [update] = useUpdate();
  const [create] = useCreate();

  const progress = useMemo(() => getLaunchChecklistProgress(items), [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, DealLaunchChecklistItem[]>();
    for (const item of items) {
      const key = item.category || "other";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [items]);

  const handleToggle = (item: DealLaunchChecklistItem, checked: boolean) => {
    if (!canEdit) return;
    update(
      "deal_launch_checklist_items",
      {
        id: item.id,
        data: {
          is_completed: checked,
          completed_at: checked ? new Date().toISOString() : null,
          completed_by_member_id: checked ? identity?.id : null,
        },
        previousData: item,
      },
      {
        onSuccess: () => refresh(),
        onError: () =>
          notify("Could not update checklist item", { type: "error" }),
      },
    );
  };

  const handleGenerate = async () => {
    if (!record.org_id) {
      notify("Project org is missing", { type: "error" });
      return;
    }
    setGenerating(true);
    try {
      const count = await generateLaunchChecklistFromTemplate({
        dataProvider,
        dealId: record.id,
        orgId: record.org_id,
        projectType: record.project_type,
      });
      refresh();
      notify(
        count > 0
          ? `${count} checklist item${count === 1 ? "" : "s"} added from template`
          : "Checklist is already up to date",
        { type: "info" },
      );
    } catch {
      notify("Could not generate checklist", { type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const handleAddCustom = () => {
    if (!record.org_id) return;
    create(
      "deal_launch_checklist_items",
      {
        data: {
          org_id: record.org_id,
          deal_id: record.id,
          category: "other",
          label: "New checklist item",
          is_required: true,
          is_completed: false,
          order_index: items.length + 1,
        },
      },
      {
        onSuccess: () => {
          refresh();
          notify("Checklist item added", { type: "info" });
        },
        onError: () => notify("Could not add item", { type: "error" }),
      },
    );
  };

  if (isPending) {
    return <div className="text-sm text-muted-foreground">Loading checklist…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Launch readiness</div>
            <div className="text-sm text-muted-foreground">
              {progress.completedRequired} of {progress.totalRequired} required
              items complete
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generating}
                  onClick={() => void handleGenerate()}
                >
                  Generate from template
                </Button>
                <Button type="button" size="sm" onClick={handleAddCustom}>
                  Add item
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <Progress value={progress.percent} className="mt-3 h-2" />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No launch checklist yet. Generate items from the website template to
          track go-live tasks.
        </div>
      ) : (
        grouped.map(([category, categoryItems]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {getLaunchChecklistCategoryLabel(category)}
            </h3>
            <div className="space-y-2">
              {categoryItems.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    checked={!!item.is_completed}
                    disabled={!canEdit}
                    onCheckedChange={(value) =>
                      handleToggle(item, value === true)
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{item.label}</span>
                    {!item.is_required ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Optional
                      </span>
                    ) : null}
                    {item.description ? (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))
      )}

      {canEdit && items.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Categories:{" "}
          {LAUNCH_CHECKLIST_CATEGORIES.map((item) => item.label).join(" · ")}
        </p>
      ) : null}
    </div>
  );
};
