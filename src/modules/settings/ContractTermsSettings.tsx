import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, Save, Send, Star, Trash2 } from "lucide-react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { billingIntervalSuffix } from "@/modules/catalog/catalogConstants";
import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";
import { CreateClientSubscriptionDialog } from "@/modules/billing/subscriptions/CreateClientSubscriptionDialog";
import {
  buildSubscriptionContractVariables,
  mergeSubscriptionContractTerms,
} from "@/modules/billing/subscriptions/subscriptionAgreementMerge";
import {
  getDefaultContractTermsSeed,
  LBS_DEFAULT_CONTRACT_TERMS_VERSION,
} from "@/modules/proposals/defaultContractTerms";
import { getWebMaintenanceContractTermsSeed } from "@/modules/proposals/maintenanceContractTerms";
import {
  CONTRACT_CLIENT_AUTO_FILL_FIELDS,
  CONTRACT_POLICY_FIELD_GROUPS,
  CONTRACT_PROVIDER_FIELDS,
} from "@/modules/proposals/proposalCommercialConstants";
import type { OrganizationContractTerms, ServicePackage } from "@/modules/types";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "template";

type EditorMode = "closed" | "new" | "edit";

const packageLabel = (pkg: ServicePackage) => {
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: pkg.currency ?? "USD",
  }).format(Number(pkg.suggested_price) || 0);
  const interval = billingIntervalSuffix(
    pkg.billing_type,
    pkg.billing_interval,
  );
  return `${pkg.name} · ${price}${interval ? ` ${interval}` : ""}`;
};

const buildPreviewMarkdown = (
  row: Pick<
    OrganizationContractTerms,
    "body_markdown" | "version" | "default_variables"
  >,
  linkedPackage?: ServicePackage | null,
) => {
  const sampleLine = linkedPackage
    ? [
        {
          description: linkedPackage.name,
          quantity: 1,
          unit_price: Number(linkedPackage.suggested_price) || 0,
          package_id: Number(linkedPackage.id),
        },
      ]
    : [
        {
          description: "Website Maintenance",
          quantity: 1,
          unit_price: 199,
        },
      ];

  const amount = sampleLine.reduce(
    (sum, line) => sum + (line.quantity ?? 1) * (line.unit_price ?? 0),
    0,
  );

  const variables = buildSubscriptionContractVariables({
    clientName: "Acme Restoration LLC",
    clientAddress: "320 Ocean Pkwy, Brooklyn, NY 11218",
    clientRepresentative: "Jane Doe",
    providerRepresentative: "Latinos Business Support LLC",
    subscriptionName: linkedPackage?.name ?? "Website Maintenance",
    subscriptionNumber: "SUB-2026-0042",
    amount,
    currency: linkedPackage?.currency ?? "USD",
    billingInterval: linkedPackage?.billing_interval ?? "monthly",
    lineItems: sampleLine,
    termsVersion: row.version,
    defaultVariables: row.default_variables ?? null,
  });

  return mergeSubscriptionContractTerms(row.body_markdown, variables);
};

const formatContractTermsSaveError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("organization_contract_terms_org_slug_idx") ||
    message.includes("(org_id, slug)")
  ) {
    return "A template with this slug already exists. Edit the existing template or change the slug.";
  }
  if (message.includes("organization_contract_terms_org_slug_version_idx")) {
    return "This slug and version already exist. Bump the version (e.g. 1.1) or edit the existing template.";
  }
  if (message.includes("organization_contract_terms_org_id_version_key")) {
    return "Another template already uses this version number. Change the version field — each template slug can share v1.0 after the DB migration is applied.";
  }
  return message || "Failed to save template";
};

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

  const { data: billingPackages = [] } = useGetList<ServicePackage>(
    "service_packages",
    {
      filter: { "billing_type@eq": "recurring" },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "name", order: "ASC" },
    },
  );

  const recurringPackages = useMemo(
    () => billingPackages.filter((pkg) => pkg.active !== false),
    [billingPackages],
  );

  const activeTemplates = useMemo(
    () => termsRows.filter((row) => row.is_active !== false),
    [termsRows],
  );

  const packageByTermsId = useMemo(() => {
    const map = new Map<number, ServicePackage>();
    for (const pkg of recurringPackages) {
      const termsId = pkg.default_contract_terms_id;
      if (termsId == null) continue;
      map.set(Number(termsId), pkg);
    }
    return map;
  }, [recurringPackages]);

  const [editorMode, setEditorMode] = useState<EditorMode>("closed");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [previewRow, setPreviewRow] = useState<OrganizationContractTerms | null>(
    null,
  );
  const [sendRow, setSendRow] = useState<OrganizationContractTerms | null>(null);

  const editingRow =
    editorMode === "edit"
      ? (activeTemplates.find((row) => String(row.id) === String(editingId)) ??
        null)
      : null;

  const [slug, setSlug] = useState("general");
  const [version, setVersion] = useState(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
  const [title, setTitle] = useState(getDefaultContractTermsSeed().title);
  const [body, setBody] = useState(getDefaultContractTermsSeed().body_markdown);
  const [defaultVariables, setDefaultVariables] = useState<
    Record<string, string>
  >({ ...getDefaultContractTermsSeed().default_variables });
  const [linkedPackageId, setLinkedPackageId] = useState<number | null>(null);

  const dialogOpen = editorMode !== "closed";

  useEffect(() => {
    if (editorMode === "new") {
      setSlug("new-template");
      setVersion("1.0");
      setTitle("New contract template");
      setBody("# Contract\n\n**Client:** {{client_name}}\n\n{{line_items}}\n");
      setDefaultVariables({ ...getDefaultContractTermsSeed().default_variables });
      setLinkedPackageId(null);
      return;
    }
    if (editorMode === "edit" && editingRow) {
      setSlug(editingRow.slug ?? "general");
      setVersion(editingRow.version);
      setTitle(editingRow.title);
      setBody(editingRow.body_markdown);
      setDefaultVariables({
        ...(editingRow.default_variables ?? getDefaultContractTermsSeed().default_variables),
      });
      const linked = packageByTermsId.get(Number(editingRow.id));
      setLinkedPackageId(linked ? Number(linked.id) : null);
    }
  }, [editorMode, editingRow, packageByTermsId]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["organization_contract_terms"],
        refetchType: "all",
      }),
      queryClient.invalidateQueries({
        queryKey: ["service_packages"],
        refetchType: "all",
      }),
    ]);
  };

  const syncLinkedBillingPackage = async (termsId: number | string) => {
    const termsIdNum = Number(termsId);
    const previouslyLinked = recurringPackages.filter(
      (pkg) =>
        pkg.default_contract_terms_id != null &&
        Number(pkg.default_contract_terms_id) === termsIdNum,
    );

    for (const pkg of previouslyLinked) {
      if (linkedPackageId == null || Number(pkg.id) !== linkedPackageId) {
        await update(
          "service_packages",
          {
            id: pkg.id,
            data: { default_contract_terms_id: null },
            previousData: pkg,
          },
          { returnPromise: true },
        );
      }
    }

    if (linkedPackageId == null) return;

    const selected = recurringPackages.find(
      (pkg) => Number(pkg.id) === linkedPackageId,
    );
    if (
      !selected ||
      Number(selected.default_contract_terms_id) === termsIdNum
    ) {
      return;
    }

    await update(
      "service_packages",
      {
        id: selected.id,
        data: { default_contract_terms_id: termsIdNum },
        previousData: selected,
      },
      { returnPromise: true },
    );
  };

  const closeEditor = () => {
    setEditorMode("closed");
    setEditingId(null);
  };

  const openNew = () => {
    setEditingId(null);
    setEditorMode("new");
  };

  const openEdit = (row: OrganizationContractTerms) => {
    setEditingId(row.id);
    setEditorMode("edit");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        version: version.trim() || LBS_DEFAULT_CONTRACT_TERMS_VERSION,
        title: title.trim(),
        body_markdown: body,
        slug: slugify(slug),
        is_active: true,
        default_variables: defaultVariables,
      };
      if (editorMode === "new") {
        const existingSlug = termsRows.find(
          (row) => row.slug === payload.slug,
        );
        if (existingSlug) {
          throw new Error(
            `Template slug "${payload.slug}" already exists. Edit that template instead of creating a duplicate.`,
          );
        }
      }
      if (editorMode === "edit" && editingRow) {
        await update(
          "organization_contract_terms",
          {
            id: editingRow.id,
            data: payload,
            previousData: editingRow,
          },
          { returnPromise: true },
        );
        await syncLinkedBillingPackage(editingRow.id);
        return editingRow.id;
      }
      const created = await create(
        "organization_contract_terms",
        {
          data: {
            org_id: orgId,
            ...payload,
            is_default: activeTemplates.length === 0,
            published_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
      const createdId = (created as { data?: { id?: number } })?.data?.id;
      if (createdId != null) {
        await syncLinkedBillingPackage(createdId);
      }
      return createdId ?? null;
    },
    onSuccess: async () => {
      await invalidate();
      closeEditor();
      notify("Contract template saved", { type: "success" });
    },
    onError: (error) =>
      notify(formatContractTermsSaveError(error), { type: "error" }),
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
      if (editingId != null) closeEditor();
      await invalidate();
      notify("Template deactivated", { type: "success" });
    },
    onError: (error) =>
      notify(
        error instanceof Error ? error.message : "Failed to deactivate",
        { type: "error" },
      ),
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading templates…</p>;
  }

  const editorDialog = (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      <DialogContent className="flex max-h-[min(92vh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle>
            {editorMode === "new" ? "New contract template" : "Configure contract"}
          </DialogTitle>
          <DialogDescription>
            {editorMode === "edit" && editingRow
              ? `${editingRow.slug ?? "—"} · v${editingRow.version}`
              : "LBS company on one side; client fields auto-fill when you pick the contact."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Linked billing item</Label>
            <Select
              value={linkedPackageId != null ? String(linkedPackageId) : "none"}
              onValueChange={(value) =>
                setLinkedPackageId(value === "none" ? null : Number(value))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {recurringPackages.map((pkg) => (
                  <SelectItem key={String(pkg.id)} value={String(pkg.id)}>
                    {packageLabel(pkg)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only <strong>recurring</strong> catalog items appear here (
              {recurringPackages.length} active). One-time packages (e.g. Website
              Starter) are for invoices and proposals, not subscription agreements.
              {recurringPackages.length === 0 ? (
                <>
                  {" "}
                  <Link
                    to="/billing?tab=catalog"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Add a recurring item
                  </Link>{" "}
                  under Billing → Products & services (billing type: Recurring,
                  e.g. Website maintenance).
                </>
              ) : (
                <>
                  {" "}
                  Need web maintenance?{" "}
                  <Link
                    to="/billing?tab=catalog"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Create one in Products & services
                  </Link>{" "}
                  with billing type Recurring, then link it here.
                </>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <Label className="text-sm">LBS / provider company</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your company block on every contract. Same for all clients.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CONTRACT_PROVIDER_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label
                        htmlFor={`contract-var-${field.key}`}
                        className="text-xs font-normal"
                      >
                        {field.label}
                      </Label>
                      <Input
                        id={`contract-var-${field.key}`}
                        value={defaultVariables[field.key] ?? ""}
                        onChange={(event) =>
                          setDefaultVariables((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        placeholder={`{{${field.key}}}`}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-dashed bg-muted/15 p-3">
                <div>
                  <Label className="text-sm">Filled when you pick the client</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Automatic from the CRM company/contact and the subscription
                    you create. Not edited here.
                  </p>
                </div>
                <ul className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                  {CONTRACT_CLIENT_AUTO_FILL_FIELDS.map((field) => (
                    <li
                      key={field.key}
                      className="rounded-md border border-transparent bg-background/60 px-2 py-1.5"
                    >
                      <span className="font-medium text-foreground/80">
                        {field.label}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] opacity-70">
                        {`{{${field.key}}}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div>
                <Label className="text-sm">
                  Template policy (not from client)
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Term length, notices, SLA, billing, and legal defaults. These
                  stay the same until you change them here — choosing a client
                  does not override them.
                </p>
              </div>
              {CONTRACT_POLICY_FIELD_GROUPS.map((section) => {
                const isMaintenanceContext =
                  slug.includes("maintenance") ||
                  "included_hours" in defaultVariables ||
                  "response_time" in defaultVariables;
                if (
                  section.group === "Service plan defaults" &&
                  !isMaintenanceContext
                ) {
                  return null;
                }
                return (
                  <div key={section.group} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {section.group}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {section.fields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label
                            htmlFor={`contract-var-${field.key}`}
                            className="text-xs font-normal"
                          >
                            {field.label}
                          </Label>
                          <Input
                            id={`contract-var-${field.key}`}
                            value={defaultVariables[field.key] ?? ""}
                            onChange={(event) =>
                              setDefaultVariables((prev) => ({
                                ...prev,
                                [field.key]: event.target.value,
                              }))
                            }
                            placeholder={`{{${field.key}}}`}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Body (Markdown)</Label>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={14}
              className="min-h-[240px] w-full font-mono text-xs"
            />
          </div>
          {editorMode === "new" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const seed = getDefaultContractTermsSeed();
                  setSlug("general");
                  setVersion(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
                  setTitle(seed.title);
                  setBody(seed.body_markdown);
                  setDefaultVariables({ ...seed.default_variables });
                }}
              >
                Load default LBS terms
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const seed = getWebMaintenanceContractTermsSeed();
                  setSlug(seed.slug);
                  setVersion(seed.version);
                  setTitle(seed.title);
                  setBody(seed.body_markdown);
                  setDefaultVariables({ ...seed.default_variables });
                  const maintenancePackage = recurringPackages.find((pkg) =>
                    /maintenance/i.test(pkg.name),
                  );
                  setLinkedPackageId(
                    maintenancePackage?.id != null
                      ? Number(maintenancePackage.id)
                      : null,
                  );
                }}
              >
                Load web maintenance contract
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const seed = getWebMaintenanceContractTermsSeed();
                  if (
                    !window.confirm(
                      "Replace body and defaults with the latest web maintenance seed? Unsaved edits will be lost.",
                    )
                  ) {
                    return;
                  }
                  setVersion(seed.version);
                  setTitle(seed.title);
                  setBody(seed.body_markdown);
                  setDefaultVariables({ ...seed.default_variables });
                }}
              >
                Refresh from maintenance seed
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={closeEditor}>
            Cancel
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const previewDialog = previewRow ? (
    <Dialog open onOpenChange={() => setPreviewRow(null)}>
      <DialogContent className="flex max-h-[min(94vh,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,920px)]">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle>Preview — {previewRow.title}</DialogTitle>
          <DialogDescription>
            A4-style layout with sample client data. Placeholders are filled for
            preview only.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#e5e7eb]">
          <ContractDocumentMarkdown page>
            {buildPreviewMarkdown(
              previewRow,
              packageByTermsId.get(Number(previewRow.id)) ?? null,
            )}
          </ContractDocumentMarkdown>
        </div>
        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={() => setPreviewRow(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  const sendPackageId = sendRow
    ? (packageByTermsId.get(Number(sendRow.id))?.id ?? null)
    : null;

  const fields = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {activeTemplates.length} template
          {activeTemplates.length === 1 ? "" : "s"}
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={openNew}>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>

      {activeTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No templates yet.</p>
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            onClick={openNew}
          >
            Create first template
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeTemplates.map((row) => {
            const linkedPackage = packageByTermsId.get(Number(row.id));

            return (
              <Card
                key={String(row.id)}
                className={cn(
                  "flex flex-col",
                  row.is_default && "border-amber-400/60",
                )}
              >
                <CardHeader className="space-y-1 pb-2">
                  <CardTitle className="flex items-start gap-2 text-sm leading-snug">
                    <span className="min-w-0 flex-1">{row.title}</span>
                    {row.is_default ? (
                      <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-500" />
                    ) : null}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {row.slug ?? "—"} · v{row.version}
                  </CardDescription>
                  {linkedPackage ? (
                    <p className="text-xs text-muted-foreground">
                      Billing item: {linkedPackage.name}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="flex-1 pb-2">
                  <p className="line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {row.body_markdown.replace(/^#+\s*/gm, "").slice(0, 180) ||
                      "No body yet."}
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-3.5" />
                      Configure
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewRow(row)}
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSendRow(row)}
                    >
                      <Send className="size-3.5" />
                      Send
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={row.is_default || setDefaultMutation.isPending}
                      onClick={() => setDefaultMutation.mutate(row)}
                    >
                      <Star className="size-3.5" />
                      Default
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={deactivateMutation.isPending}
                      onClick={() => deactivateMutation.mutate(row)}
                    >
                      <Trash2 className="size-3.5" />
                      Deactivate
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {editorDialog}
      {previewDialog}

      <CreateClientSubscriptionDialog
        open={sendRow != null}
        onOpenChange={(open) => {
          if (!open) setSendRow(null);
        }}
        initialEnrollmentMode="agreement"
        initialContractTermsId={
          sendRow?.id != null ? Number(sendRow.id) : null
        }
        initialPackageId={
          sendPackageId != null ? Number(sendPackageId) : null
        }
      />
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
          Library of agreements for proposals and subscription enrollment.
          Edit key defaults (term length, notices, SLA) once for all clients,
          link a recurring billing item, preview, or send an agreement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{fields}</CardContent>
    </Card>
  );
};
