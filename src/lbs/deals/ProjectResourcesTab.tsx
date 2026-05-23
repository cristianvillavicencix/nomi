import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCreate,
  useDelete,
  useGetList,
  useGetOne,
  useNotify,
  type Identifier,
} from "ra-core";
import { ImagePlus, Link2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Contact } from "@/components/atomic-crm/types";
import { SendProjectResourcesDialog } from "@/lbs/deals/SendProjectResourcesDialog";
import { ProjectResourceLinkedDocs } from "@/lbs/deals/ProjectResourceLinkedDocs";
import { formatTabCount } from "@/lbs/deals/dealProjectTabUtils";
import {
  PROJECT_RESOURCE_TAB_CATEGORIES,
  type ProjectResourceTabCategory,
} from "@/lbs/deals/projectResourceConstants";
import {
  buildProjectResourceRecord,
  uploadProjectResourceFile,
} from "@/lbs/deals/projectResourceUpload";
import {
  getTabCategoryCounts,
  groupResourcesByTabCategory,
  groupServicePhotosByLabel,
} from "@/lbs/deals/projectResourceGrouping";
import { ResourceCategoryContent } from "@/lbs/deals/ResourceCategorySection";
import { ResourceLightbox } from "@/lbs/deals/ResourceLightbox";
import { ResourceUploadDialog } from "@/lbs/deals/ResourceUploadDialog";
import {
  getSupabaseSchemaMissingMessage,
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/lbs/deals/supabaseSchemaErrors";
import type { DealResource, LbsDeal } from "@/lbs/types";

const getContactEmail = (contact?: Contact | null) =>
  contact?.email_jsonb?.find((entry) => entry.email?.trim())?.email?.trim() ??
  "";

const getContactName = (contact?: Contact | null) =>
  `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim();

export const ProjectResourcesTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [create] = useCreate();
  const [deleteOne] = useDelete();

  const [sendOpen, setSendOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] =
    useState<ProjectResourceTabCategory>("logo");
  const [previewResource, setPreviewResource] = useState<DealResource | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<Identifier | null>(null);

  const [uploadCategory, setUploadCategory] =
    useState<ProjectResourceTabCategory>("logo");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

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

  const grouped = useMemo(
    () => groupResourcesByTabCategory(resources),
    [resources],
  );
  const tabCounts = useMemo(() => getTabCategoryCounts(resources), [resources]);
  const serviceGroups = useMemo(
    () => groupServicePhotosByLabel(resources),
    [resources],
  );

  const openUpload = (category: ProjectResourceTabCategory = activeTab) => {
    setUploadCategory(category);
    setUploadLabel("");
    setUploadFiles([]);
    setUploadOpen(true);
  };

  const { mutate: uploadResources, isPending: isUploading } = useMutation({
    mutationFn: async () => {
      if (uploadFiles.length === 0) {
        throw new Error("Choose at least one file");
      }
      if (uploadCategory === "service-photo" && !uploadLabel.trim()) {
        throw new Error("Enter the service name for these photos");
      }

      for (const file of uploadFiles) {
        const uploaded = await uploadProjectResourceFile(record.id, file);
        await create(
          "deal_resources",
          {
            data: buildProjectResourceRecord({
              dealId: record.id,
              category: uploadCategory,
              label: uploadLabel.trim() || undefined,
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

  if (isPending) return null;

  if (isError && isSupabaseSchemaMissingError(error, "deal_resources")) {
    return (
      <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-6">
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Project resources</h3>
          <p className="text-sm text-muted-foreground">
            Logos, service photos, team images, documents, and other project
            files.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSendOpen(true)}
          >
            <Link2 className="size-4" />
            Request from client
          </Button>
          <Button type="button" onClick={() => openUpload(activeTab)}>
            <ImagePlus className="size-4" />
            Upload files
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as ProjectResourceTabCategory)
        }
      >
        <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {PROJECT_RESOURCE_TAB_CATEGORIES.map((categoryDef) => (
            <TabsTrigger
              key={categoryDef.id}
              value={categoryDef.id}
              className="shrink-0"
            >
              {categoryDef.label}
              {formatTabCount(tabCounts[categoryDef.id])}
            </TabsTrigger>
          ))}
        </TabsList>

        {PROJECT_RESOURCE_TAB_CATEGORIES.map((categoryDef) => (
          <TabsContent
            key={categoryDef.id}
            value={categoryDef.id}
            className="space-y-4 pt-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {categoryDef.description}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openUpload(categoryDef.id)}
              >
                <Upload className="size-4" />
                Add files
              </Button>
            </div>

            <ResourceCategoryContent
              categoryId={categoryDef.id}
              items={grouped.get(categoryDef.id) ?? []}
              serviceGroups={
                categoryDef.id === "service-photo" ? serviceGroups : undefined
              }
              onPreview={setPreviewResource}
              onDelete={handleDelete}
              deletingId={deletingId}
            />

            {categoryDef.id === "document" ? (
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
        resource={previewResource}
        onClose={() => setPreviewResource(null)}
      />

      <ResourceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        category={uploadCategory}
        label={uploadLabel}
        onLabelChange={setUploadLabel}
        files={uploadFiles}
        onFilesChange={setUploadFiles}
        onUpload={() => uploadResources()}
        isUploading={isUploading}
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
      />
    </div>
  );
};
