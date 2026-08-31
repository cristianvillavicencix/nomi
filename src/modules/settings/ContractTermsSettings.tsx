import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Star } from "lucide-react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { OrganizationContractTerms } from "@/modules/types";
import {
  getDefaultContractTermsSeed,
  LBS_DEFAULT_CONTRACT_TERMS_VERSION,
} from "@/modules/proposals/defaultContractTerms";
import {
  getWebMaintenanceContractTermsSeed,
  WEB_MAINTENANCE_CONTRACT_SLUG,
} from "@/modules/contracts/webMaintenanceContractTerms";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "template";

export const ContractTermsSettings = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [create] = useCreate();
  const [update] = useUpdate();

  const { data: termsRows = [], isPending } =
    useGetList<OrganizationContractTerms>("organization_contract_terms", {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    });

  const activeTemplates = useMemo(
    () => termsRows.filter((row) => row.is_active !== false),
    [termsRows],
  );

  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const selected =
    activeTemplates.find((row) => String(row.id) === String(selectedId)) ??
    activeTemplates[0] ??
    null;

  useEffect(() => {
    if (!selectedId && activeTemplates[0]) {
      setSelectedId(activeTemplates[0].id);
    }
  }, [activeTemplates, selectedId]);

  const [slug, setSlug] = useState("general");
  const [version, setVersion] = useState(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
  const [title, setTitle] = useState(getDefaultContractTermsSeed().title);
  const [body, setBody] = useState(getDefaultContractTermsSeed().body_markdown);

  useEffect(() => {
    if (!selected) return;
    setSlug(selected.slug ?? "general");
    setVersion(selected.version);
    setTitle(selected.title);
    setBody(selected.body_markdown);
  }, [selected]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["organization_contract_terms"],
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        version: version.trim() || LBS_DEFAULT_CONTRACT_TERMS_VERSION,
        title: title.trim(),
        body_markdown: body,
        slug: slugify(slug),
        is_active: true,
      };
      if (selected) {
        return update(
          "organization_contract_terms",
          {
            id: selected.id,
            data: payload,
            previousData: selected,
          },
          { returnPromise: true },
        );
      }
      return create(
        "organization_contract_terms",
        {
          data: {
            org_id: orgId,
            ...payload,
            default_variables: getDefaultContractTermsSeed().default_variables,
            is_default: activeTemplates.length === 0,
            published_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      await invalidate();
      notify("Contract template saved", { type: "success" });
    },
    onError: (error) =>
      notify(
        error instanceof Error ? error.message : "Failed to save template",
        { type: "error" },
      ),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (row: OrganizationContractTerms) => {
      const currentDefault = activeTemplates.find((item) => item.is_default);
      if (currentDefault && String(currentDefault.id) !== String(row.id)) {
        await update(
          "organization_contract_terms",
          {
            id: currentDefault.id,
            data: { is_default: false },
            previousData: currentDefault,
          },
          { returnPromise: true },
        );
      }
      await update(
        "organization_contract_terms",
        {
          id: row.id,
          data: { is_default: true, is_active: true },
          previousData: row,
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      await invalidate();
      notify("Default contract updated", { type: "success" });
    },
    onError: () =>
      notify("Failed to set default contract", { type: "error" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (row: OrganizationContractTerms) => {
      if (row.is_default) {
        throw new Error("Set another default before deactivating this template");
      }
      return update(
        "organization_contract_terms",
        {
          id: row.id,
          data: { is_active: false },
          previousData: row,
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      setSelectedId(null);
      await invalidate();
      notify("Template deactivated", { type: "success" });
    },
    onError: (error) =>
      notify(
        error instanceof Error ? error.message : "Failed to deactivate",
        { type: "error" },
      ),
  });

  const addWebMaintenanceMutation = useMutation({
    mutationFn: async () => {
      const existing = termsRows.find(
        (row) => row.slug === WEB_MAINTENANCE_CONTRACT_SLUG,
      );
      if (existing) {
        if (!existing.is_active) {
          await update(
            "organization_contract_terms",
            {
              id: existing.id,
              data: { is_active: true },
              previousData: existing,
            },
            { returnPromise: true },
          );
        }
        return existing;
      }
      const seed = getWebMaintenanceContractTermsSeed();
      return create(
        "organization_contract_terms",
        {
          data: {
            org_id: orgId,
            ...seed,
            published_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
    },
    onSuccess: async (row) => {
      await invalidate();
      if (row && typeof row === "object" && "id" in row) {
        setSelectedId((row as OrganizationContractTerms).id);
      }
      notify("Web Maintenance template ready", { type: "success" });
    },
    onError: (error) =>
      notify(
        error instanceof Error ? error.message : "Failed to add template",
        { type: "error" },
      ),
  });

  const startNew = () => {
    setSelectedId("__new__");
    setSlug("new-template");
    setVersion("1.0");
    setTitle("New contract template");
    setBody("# Contract\n\n**Client:** {{client_name}}\n\n{{line_items}}\n");
  };

  const editingNew = selectedId === "__new__";

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading templates…</p>;
  }

  const fields = (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={startNew}>
            <Plus className="size-3.5" />
            New
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={addWebMaintenanceMutation.isPending}
            onClick={() => addWebMaintenanceMutation.mutate()}
          >
            {addWebMaintenanceMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Web Maintenance
          </Button>
        </div>
        <ul className="space-y-1 rounded-md border p-1">
          {activeTemplates.map((row) => (
            <li key={String(row.id)}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                  String(selected?.id) === String(row.id) && "bg-muted",
                )}
                onClick={() => setSelectedId(row.id)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {row.title}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.slug ?? "—"} · v{row.version}
                  </span>
                </span>
                {row.is_default ? (
                  <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-500" />
                ) : null}
              </button>
            </li>
          ))}
          {activeTemplates.length === 0 ? (
            <li className="px-2 py-3 text-xs text-muted-foreground">
              No templates yet.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="space-y-4">
        {!selected && !editingNew ? (
          <Button type="button" variant="secondary" onClick={startNew}>
            Create first template
          </Button>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body (Markdown)</Label>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={16}
                className="min-h-[280px] w-full font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save template
              </Button>
              {selected && !editingNew ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      selected.is_default || setDefaultMutation.isPending
                    }
                    onClick={() => setDefaultMutation.mutate(selected)}
                  >
                    Set as default
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deactivateMutation.isPending}
                    onClick={() => deactivateMutation.mutate(selected)}
                  >
                    Deactivate
                  </Button>
                </>
              ) : null}
              {!selected || editingNew ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const seed = getDefaultContractTermsSeed();
                    setSlug("general");
                    setVersion(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
                    setTitle(seed.title);
                    setBody(seed.body_markdown);
                  }}
                >
                  Load default LBS terms
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return <div className="space-y-4">{fields}</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Contract templates</CardTitle>
        <CardDescription>
          Library of agreements for proposals and subscription enrollment. Use{" "}
          {"{{variables}}"} such as client_name, line_items, total_amount,
          recurring_terms, terms_version.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{fields}</CardContent>
    </Card>
  );
};
