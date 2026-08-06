import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCreate,
  useDelete,
  useGetList,
  useGetOne,
  useNotify,
  type Identifier,
} from "ra-core";
import { Download, ImagePlus, Link2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Contact } from "@/components/atomic-crm/types";
import { SendProjectResourcesDialog } from "@/modules/deals/SendProjectResourcesDialog";
import { ProjectResourceLinkedDocs } from "@/modules/deals/ProjectResourceLinkedDocs";
import { formatTabCount } from "@/modules/deals/dealProjectTabUtils";
import {
  buildServiceCategory,
  PROJECT_RESOURCE_TAB_CATEGORIES,
  slugifyServiceName,
  type ProjectResourceCategory,
  type ProjectResourceTabCategory,
} from "@/modules/deals/projectResourceConstants";
import {
  FULL_RESOURCE_REQUEST,
  scopeForFullResourceRequest,
  scopeForResourceTab,
  type ResourceRequestScope,
} from "@/modules/deals/projectResourceRequestScope";
import { downloadResourcesAsZip } from "@/modules/deals/projectResourceZipDownload";
import {
  buildProjectResourceRecord,
  uploadProjectResourceFile,
} from "@/modules/deals/projectResourceUpload";
import { serviceSlugsFromBrief } from "@/modules/deals/projectBriefServiceSlugs";
import {
  buildBeforeAfterSubTabs,
  buildMainResourceTabs,
  buildServiceSubTabs,
  getBeforeAfterSubTabCounts,
  getMainTabCounts,
  getResourcesForBeforeAfterSubTab,
  getResourcesForMainTab,
  getResourcesForServiceSubTab,
  getServiceSubTabCounts,
  readPendingServiceSlugs,
  writePendingServiceSlugs,
  type ProjectResourceTabDef,
} from "@/modules/deals/projectResourceTabs";
import { ResourceCategoryContent } from "@/modules/deals/ResourceCategorySection";
import { ResourceLightbox } from "@/modules/deals/ResourceLightbox";
import {
  ResourceUploadDialog,
  type BeforeAfterPhotoType,
} from "@/modules/deals/ResourceUploadDialog";
import {
  getSupabaseSchemaMissingMessage,
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/modules/deals/supabaseSchemaErrors";
import type { DealResource, LbsDeal } from "@/modules/types";

const getContactEmail = (contact?: Contact | null) =>
  contact?.email_jsonb?.find((entry) => entry.email?.trim())?.email?.trim() ??
  "";

const getContactName = (contact?: Contact | null) =>
  `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim();

const buildBeforeAfterResourceLabel = (
  photoType: BeforeAfterPhotoType,
  caption?: string,
) => {
  const base = photoType === "before" ? "Before" : "After";
  const trimmed = caption?.trim();
  return trimmed ? `${base} — ${trimmed}` : base;
};

export const ProjectResourcesTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [create] = useCreate();
  const [deleteOne] = useDelete();

  const [sendOpen, setSendOpen] = useState(false);
  const [sendScope, setSendScope] = useState<ResourceRequestScope>(
    FULL_RESOURCE_REQUEST,
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addTabOpen, setAddTabOpen] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [pendingServiceSlugs, setPendingServiceSlugs] = useState<string[]>(() =>
    readPendingServiceSlugs(record.id),
  );
  const [activeTab, setActiveTab] =
    useState<ProjectResourceTabCategory>("logo");
  const [activeServiceTab, setActiveServiceTab] = useState<string>("");
  const [activeBeforeAfterTab, setActiveBeforeAfterTab] = useState<string>("");
  const [previewResource, setPreviewResource] = useState<DealResource | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<Identifier | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    category: string;
    label: string;
    mode?: "default" | "before-after";
  } | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadBeforeAfterService, setUploadBeforeAfterService] = useState("");
  const [uploadPhotoType, setUploadPhotoType] = useState<
    BeforeAfterPhotoType | ""
  >("");
  const [downloadingTab, setDownloadingTab] = useState(false);

  const contactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null);

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId as number },
    { enabled: contactId != null },
  );

  const {
    data: resources = [],
    isPending,
    isError,
    error,
  } = useGetList<DealResource>(
    "deal_resources",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 15_000, ...supabaseTableQueryOptions("deal_resources") },
  );

  const mainTabs = useMemo(() => buildMainResourceTabs(), []);
  const briefServiceSlugs = useMemo(
    () => serviceSlugsFromBrief(record.website_brief),
    [record.website_brief],
  );
  const serviceSubTabs = useMemo(
    () =>
      buildServiceSubTabs(resources, [
        ...pendingServiceSlugs,
        ...briefServiceSlugs,
      ]),
    [briefServiceSlugs, pendingServiceSlugs, resources],
  );
  const beforeAfterSubTabs = useMemo(
    () => buildBeforeAfterSubTabs(serviceSubTabs),
    [serviceSubTabs],
  );
  const mainTabCounts = useMemo(() => getMainTabCounts(resources), [resources]);
  const serviceSubTabCounts = useMemo(
    () => getServiceSubTabCounts(serviceSubTabs, resources),
    [resources, serviceSubTabs],
  );
  const beforeAfterSubTabCounts = useMemo(
    () => getBeforeAfterSubTabCounts(beforeAfterSubTabs, resources),
    [beforeAfterSubTabs, resources],
  );

  const activeServiceTabDef = useMemo(
    () =>
      serviceSubTabs.find((entry) => entry.id === activeServiceTab) ??
      serviceSubTabs[0] ??
      null,
    [activeServiceTab, serviceSubTabs],
  );

  const activeBeforeAfterTabDef = useMemo(
    () =>
      beforeAfterSubTabs.find((entry) => entry.id === activeBeforeAfterTab) ??
      beforeAfterSubTabs[0] ??
      null,
    [activeBeforeAfterTab, beforeAfterSubTabs],
  );

  const galleryItems = useMemo(() => {
    if (activeTab === "service-photo" && activeServiceTabDef) {
      return getResourcesForServiceSubTab(activeServiceTabDef, resources);
    }
    if (activeTab === "before-after" && activeBeforeAfterTabDef) {
      return getResourcesForBeforeAfterSubTab(
        activeBeforeAfterTabDef,
        resources,
      );
    }
    return getResourcesForMainTab(activeTab, resources);
  }, [
    activeBeforeAfterTabDef,
    activeServiceTabDef,
    activeTab,
    resources,
  ]);

  useEffect(() => {
    writePendingServiceSlugs(record.id, pendingServiceSlugs);
  }, [pendingServiceSlugs, record.id]);

  useEffect(() => {
    if (serviceSubTabs.length === 0) {
      setActiveServiceTab("");
      return;
    }
    if (!serviceSubTabs.some((entry) => entry.id === activeServiceTab)) {
      setActiveServiceTab(serviceSubTabs[0].id);
    }
  }, [activeServiceTab, serviceSubTabs]);

  useEffect(() => {
    if (beforeAfterSubTabs.length === 0) {
      setActiveBeforeAfterTab("");
      return;
    }
    if (
      !beforeAfterSubTabs.some((entry) => entry.id === activeBeforeAfterTab)
    ) {
      setActiveBeforeAfterTab(beforeAfterSubTabs[0].id);
    }
  }, [activeBeforeAfterTab, beforeAfterSubTabs]);

  const openUploadForCategory = (category: string, label: string) => {
    setUploadTarget({ category, label, mode: "default" });
    setUploadBeforeAfterService("");
    setUploadPhotoType("");
    setUploadLabel("");
    setUploadFiles([]);
    setUploadOpen(true);
  };

  const openBeforeAfterUpload = (serviceTab?: ProjectResourceTabDef) => {
    setUploadTarget({
      category: "before-after",
      label: "Before & After",
      mode: "before-after",
    });
    setUploadBeforeAfterService(
      serviceTab?.category ?? activeBeforeAfterTabDef?.category ?? "",
    );
    setUploadPhotoType("");
    setUploadLabel("");
    setUploadFiles([]);
    setUploadOpen(true);
  };

  const openUploadForCurrentView = () => {
    if (activeTab === "service-photo" && activeServiceTabDef) {
      openUploadForCategory(
        activeServiceTabDef.category,
        activeServiceTabDef.label,
      );
      return;
    }
    if (activeTab === "before-after") {
      openBeforeAfterUpload(activeBeforeAfterTabDef ?? undefined);
      return;
    }
    const def = PROJECT_RESOURCE_TAB_CATEGORIES.find(
      (entry) => entry.id === activeTab,
    );
    openUploadForCategory(activeTab, def?.label ?? activeTab);
  };

  const openRequestDialog = (scope: ResourceRequestScope) => {
    setSendScope(scope);
    setSendOpen(true);
  };

  const { mutate: uploadResources, isPending: isUploading } = useMutation({
    mutationFn: async () => {
      if (!uploadTarget) throw new Error("Missing upload category");
      if (uploadFiles.length === 0) {
        throw new Error("Choose at least one file");
      }

      const isBeforeAfterUpload = uploadTarget.mode === "before-after";
      const resolvedCategory = isBeforeAfterUpload
        ? uploadBeforeAfterService
        : uploadTarget.category;

      if (isBeforeAfterUpload) {
        if (!uploadBeforeAfterService) {
          throw new Error("Choose a service");
        }
        if (!uploadPhotoType) {
          throw new Error("Choose before or after");
        }
      }

      const resolvedLabel = isBeforeAfterUpload
        ? buildBeforeAfterResourceLabel(uploadPhotoType, uploadLabel)
        : uploadLabel.trim() || undefined;

      for (const file of uploadFiles) {
        const uploaded = await uploadProjectResourceFile(
          record.id,
          file,
          undefined,
          { category: resolvedCategory as ProjectResourceCategory },
        );
        await create(
          "deal_resources",
          {
            data: buildProjectResourceRecord({
              dealId: record.id,
              category: resolvedCategory,
              label: resolvedLabel,
              file: uploaded,
              source: "team",
            }),
          },
          { returnPromise: true },
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deal_resources"] });
      notify("Files uploaded");
      setUploadOpen(false);
      setUploadFiles([]);
      setUploadLabel("");
      setUploadBeforeAfterService("");
      setUploadPhotoType("");
    },
    onError: (error: Error) => {
      if (isSupabaseSchemaMissingError(error, "deal_resources")) {
        notify(getSupabaseSchemaMissingMessage("deal_resources"), {
          type: "error",
        });
        return;
      }
      notify(error.message || "Failed to upload files", { type: "error" });
    },
  });

  const handleDelete = async (resource: DealResource) => {
    setDeletingId(resource.id);
    try {
      await deleteOne(
        "deal_resources",
        { id: resource.id, previousData: resource },
        { returnPromise: true },
      );
      if (previewResource?.id === resource.id) {
        setPreviewResource(null);
      }
      notify("File removed");
    } catch {
      notify("Failed to remove file", { type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddServiceTab = () => {
    const slug = slugifyServiceName(newTabName);
    if (!slug || slug === "service") {
      notify("Enter a service name", { type: "warning" });
      return;
    }
    const category = buildServiceCategory(newTabName);
    setPendingServiceSlugs((current) =>
      current.includes(slug) ? current : [...current, slug],
    );
    setActiveTab("service-photo");
    setActiveServiceTab(category);
    setAddTabOpen(false);
    setNewTabName("");
    notify("Service tab created");
  };

  const handleDownloadItems = async (
    items: DealResource[],
    zipBaseName: string,
  ) => {
    if (items.length === 0) {
      notify("No files to download", { type: "warning" });
      return;
    }
    setDownloadingTab(true);
    try {
      await downloadResourcesAsZip(items, zipBaseName);
      notify("ZIP download started");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not download ZIP",
        { type: "error" },
      );
    } finally {
      setDownloadingTab(false);
    }
  };

  const buildZipBaseName = (suffix: string) =>
    `${record.name ?? "project"}-${suffix}`.replace(/\s+/g, "-");

  if (isPending) return null;

  if (isError && isSupabaseSchemaMissingError(error, "deal_resources")) {
    return (
      <div className="rounded-lg border border-dashed border-warning/40 bg-warning/10 p-6">
        <h3 className="text-base font-semibold">Resources module not ready</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {getSupabaseSchemaMissingMessage("deal_resources")}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load project resources. Try refreshing the page.
      </p>
    );
  }

  const renderTabActions = (
    tabId: ProjectResourceTabCategory,
    items: DealResource[],
    requestTarget: string,
    uploadLabelText: string,
    zipBaseName: string,
  ) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {
          PROJECT_RESOURCE_TAB_CATEGORIES.find((entry) => entry.id === tabId)
            ?.description
        }
      </p>
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                variant="secondary"
                aria-label="Request this tab"
                onClick={() =>
                  openRequestDialog(
                    scopeForResourceTab(requestTarget, {
                      serviceTabs: serviceSubTabs,
                    }),
                  )
                }
                disabled={tabId === "before-after"}
              >
                <Link2 className="size-4" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>
              {tabId === "before-after"
                ? "Client request not available for Before & After yet"
                : "Request this tab"}
            </TooltipContent>
          </Tooltip>
          {tabId !== "document" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  variant="secondary"
                  aria-label="Download ZIP"
                  disabled={downloadingTab || items.length === 0}
                  onClick={() => void handleDownloadItems(items, zipBaseName)}
                >
                  <Download className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>Download ZIP</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                variant="secondary"
                aria-label={uploadLabelText}
                onClick={() => {
                  if (tabId === "service-photo" && activeServiceTabDef) {
                    openUploadForCategory(
                      activeServiceTabDef.category,
                      activeServiceTabDef.label,
                    );
                  } else if (tabId === "before-after") {
                    openBeforeAfterUpload(activeBeforeAfterTabDef ?? undefined);
                  } else {
                    const def = PROJECT_RESOURCE_TAB_CATEGORIES.find(
                      (entry) => entry.id === tabId,
                    );
                    openUploadForCategory(tabId, def?.label ?? tabId);
                  }
                }}
              >
                <Upload className="size-4" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>{uploadLabelText}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Project resources</h3>
          <p className="text-sm text-muted-foreground">
            Photo services holds a tab per service (Roofing, etc.).
          </p>
        </div>
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  variant="secondary"
                  aria-label="Request all"
                  onClick={() =>
                    openRequestDialog(scopeForFullResourceRequest(serviceSubTabs))
                  }
                >
                  <Link2 className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>Request all</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  aria-label="Upload files"
                  onClick={openUploadForCurrentView}
                >
                  <ImagePlus className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>Upload files</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as ProjectResourceTabCategory)
        }
      >
        <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {mainTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="shrink-0">
              {tab.label}
              {formatTabCount(mainTabCounts[tab.id])}
            </TabsTrigger>
          ))}
        </TabsList>

        {mainTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-4 pt-4">
            {tab.id === "service-photo" ? (
              <div className="space-y-4">
                {renderTabActions(
                  "service-photo",
                  activeServiceTabDef
                    ? getResourcesForServiceSubTab(
                        activeServiceTabDef,
                        resources,
                      )
                    : getResourcesForMainTab("service-photo", resources),
                  activeServiceTabDef?.id ?? "service-photo",
                  "Add files",
                  buildZipBaseName(
                    activeServiceTabDef?.label ?? "photo-services",
                  ),
                )}

                <Tabs
                  value={activeServiceTab || "__empty__"}
                  onValueChange={setActiveServiceTab}
                >
                  <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-background p-1">
                    {serviceSubTabs.map((serviceTab) => (
                      <TabsTrigger
                        key={serviceTab.id}
                        value={serviceTab.id}
                        className="shrink-0"
                      >
                        {serviceTab.label}
                        {formatTabCount(serviceSubTabCounts[serviceTab.id])}
                      </TabsTrigger>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 gap-1 px-2"
                      onClick={() => setAddTabOpen(true)}
                    >
                      <Plus className="size-4" />
                      Add tab
                    </Button>
                  </TabsList>

                  {serviceSubTabs.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
                      <p>No service tabs yet.</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setAddTabOpen(true)}
                      >
                        <Plus className="size-4" />
                        Add first service
                      </Button>
                    </div>
                  ) : (
                    serviceSubTabs.map((serviceTab) => {
                      const items = getResourcesForServiceSubTab(
                        serviceTab,
                        resources,
                      );
                      return (
                        <TabsContent
                          key={serviceTab.id}
                          value={serviceTab.id}
                          className="pt-4"
                        >
                          <ResourceCategoryContent
                            categoryId="service-photo"
                            items={items}
                            onPreview={setPreviewResource}
                            onDelete={handleDelete}
                            deletingId={deletingId}
                          />
                        </TabsContent>
                      );
                    })
                  )}
                </Tabs>
              </div>
            ) : tab.id === "before-after" ? (
              <div className="space-y-4">
                {renderTabActions(
                  "before-after",
                  activeBeforeAfterTabDef
                    ? getResourcesForBeforeAfterSubTab(
                        activeBeforeAfterTabDef,
                        resources,
                      )
                    : getResourcesForMainTab("before-after", resources),
                  activeBeforeAfterTabDef?.id ?? "before-after",
                  "Add files",
                  buildZipBaseName(
                    activeBeforeAfterTabDef?.label ?? "before-after",
                  ),
                )}

                <Tabs
                  value={activeBeforeAfterTab || "__empty__"}
                  onValueChange={setActiveBeforeAfterTab}
                >
                  <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-background p-1">
                    {beforeAfterSubTabs.map((serviceTab) => (
                      <TabsTrigger
                        key={serviceTab.id}
                        value={serviceTab.id}
                        className="shrink-0"
                      >
                        {serviceTab.label}
                        {formatTabCount(
                          beforeAfterSubTabCounts[serviceTab.id],
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {beforeAfterSubTabs.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
                      <p>No services yet. Add services under Photo services first.</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          setActiveTab("service-photo");
                          setAddTabOpen(true);
                        }}
                      >
                        <Plus className="size-4" />
                        Add service
                      </Button>
                    </div>
                  ) : (
                    beforeAfterSubTabs.map((serviceTab) => {
                      const items = getResourcesForBeforeAfterSubTab(
                        serviceTab,
                        resources,
                      );
                      return (
                        <TabsContent
                          key={serviceTab.id}
                          value={serviceTab.id}
                          className="pt-4"
                        >
                          <ResourceCategoryContent
                            categoryId="before-after"
                            items={items}
                            onPreview={setPreviewResource}
                            onDelete={handleDelete}
                            deletingId={deletingId}
                          />
                        </TabsContent>
                      );
                    })
                  )}
                </Tabs>
              </div>
            ) : (
              <>
                {renderTabActions(
                  tab.id as ProjectResourceTabCategory,
                  getResourcesForMainTab(
                    tab.id as ProjectResourceTabCategory,
                    resources,
                  ),
                  tab.id,
                  "Add files",
                  buildZipBaseName(tab.label),
                )}
                <ResourceCategoryContent
                  categoryId={tab.id as ProjectResourceTabCategory}
                  items={getResourcesForMainTab(
                    tab.id as ProjectResourceTabCategory,
                    resources,
                  )}
                  onPreview={setPreviewResource}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              </>
            )}

            {tab.id === "document" ? (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <h4 className="text-sm font-semibold">Linked records</h4>
                  <p className="text-sm text-muted-foreground">
                    Proposals, contracts, and form submissions tied to this
                    project.
                  </p>
                </div>
                <ProjectResourceLinkedDocs dealId={record.id} />
              </div>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>

      <ResourceLightbox
        resources={galleryItems}
        resource={previewResource}
        onClose={() => setPreviewResource(null)}
        onNavigate={setPreviewResource}
      />

      <ResourceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        category={uploadTarget?.category ?? "logo"}
        categoryLabel={uploadTarget?.label}
        label={uploadLabel}
        onLabelChange={setUploadLabel}
        files={uploadFiles}
        onFilesChange={setUploadFiles}
        onUpload={() => uploadResources()}
        isUploading={isUploading}
        uploadMode={
          uploadTarget?.mode === "before-after"
            ? "before-after"
            : uploadTarget?.category === "service-photo" ||
                uploadTarget?.category.startsWith("service:")
              ? "service-name"
              : "default"
        }
        serviceOptions={beforeAfterSubTabs.map((tab) => ({
          value: tab.category,
          label: tab.label,
        }))}
        selectedService={uploadBeforeAfterService}
        onServiceChange={setUploadBeforeAfterService}
        photoType={uploadPhotoType}
        onPhotoTypeChange={setUploadPhotoType}
      />

      <SendProjectResourcesDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        dealId={record.id}
        companyId={record.company_id}
        contactId={contactId as Identifier | undefined}
        clientEmail={getContactEmail(contact)}
        clientName={getContactName(contact)}
        projectName={record.name}
        requestScope={sendScope}
      />

      <Dialog open={addTabOpen} onOpenChange={setAddTabOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New service tab</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="new-service-tab">Service name</Label>
            <Input
              id="new-service-tab"
              value={newTabName}
              onChange={(event) => setNewTabName(event.target.value)}
              placeholder="e.g. Roofing, Kitchen remodeling"
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAddServiceTab();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddTabOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddServiceTab}>
              Create tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
