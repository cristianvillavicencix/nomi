import { useEffect, useMemo, useState } from "react";
import { useCreate, useGetList, useNotify } from "ra-core";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
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
import { TEMPLATE_OPTIONS } from "@/lbs/forms-v2/formBuilderConstants";
import { emptySchema } from "@/lbs/forms-v2/formBuilderUtils";
import { toSlug } from "@/lib/toSlug";
import type { FormTemplate } from "@/lbs/forms-v2/types";
import { cn } from "@/lib/utils";

type CreateFormDialogProps = {
  open: boolean;
  onClose: () => void;
};

export const CreateFormDialog = ({ open, onClose }: CreateFormDialogProps) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const [create] = useCreate();
  const [selectedSlug, setSelectedSlug] = useState("contact");
  const [formName, setFormName] = useState("Contact Form");

  const { data: templates = [] } = useGetList<FormTemplate>(
    "form_templates",
    {
      filter: { "is_system@eq": true },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: open },
  );

  const selectedTemplate = useMemo(() => {
    if (selectedSlug === "blank") return null;
    return templates.find((template) => template.slug === selectedSlug) ?? null;
  }, [selectedSlug, templates]);

  useEffect(() => {
    const option = TEMPLATE_OPTIONS.find((item) => item.slug === selectedSlug);
    if (option) setFormName(option.name);
  }, [selectedSlug]);

  const handleCreate = async () => {
    const slug = toSlug(formName);
    try {
      await create(
        "form_instances",
        {
          data: {
            name: formName.trim(),
            slug,
            template_id: selectedTemplate?.id ?? null,
            schema: selectedTemplate?.schema ?? emptySchema(),
            description: selectedTemplate?.description ?? null,
            is_active: true,
            is_public: true,
          },
        },
        {
          onSuccess: (record) => {
            onClose();
            navigate(`/forms-v2/${record.id}/edit`);
          },
        },
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to create form", {
        type: "error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new form</DialogTitle>
          <DialogDescription>
            Start from a template or build a blank form from scratch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Start from template</Label>
            <div className="grid gap-2">
              {TEMPLATE_OPTIONS.map((option) => (
                <button
                  key={option.slug}
                  type="button"
                  onClick={() => setSelectedSlug(option.slug)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition-colors",
                    selectedSlug === option.slug
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="font-medium">
                    {option.emoji} {option.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-form-name">Form name</Label>
            <Input
              id="create-form-name"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleCreate()}>
            Create form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
