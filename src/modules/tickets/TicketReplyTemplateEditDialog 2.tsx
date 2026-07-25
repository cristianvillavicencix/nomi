import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useEffect, useState } from "react";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { TicketInbox, TicketInboxReplyTemplate } from "@/modules/types";
import {
  parseInboxReplyTemplates,
  persistInboxReplyTemplates,
} from "@/modules/tickets/ticketReplyTemplateStorage";
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
import { Textarea } from "@/components/ui/textarea";

type TicketReplyTemplateEditDialogProps = {
  inbox: TicketInbox | null;
  template: TicketInboxReplyTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export const TicketReplyTemplateEditDialog = ({
  inbox,
  template,
  open,
  onOpenChange,
  onSaved,
}: TicketReplyTemplateEditDialogProps) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;
  const canManageSettings = useMemberCapability("admin.settings.manage");
  const canManageTickets = useMemberCapability("support.tickets.manage");
  const canEdit = isAdmin || canManageSettings || canManageTickets;

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open || !template) return;
    setLabel(template.label);
    setDescription(template.description?.trim() ?? "");
    setBody(template.body);
  }, [open, template]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!inbox?.id || !template?.id) {
        throw new Error("Select a template to edit");
      }

      const trimmedLabel = label.trim();
      const trimmedBody = body.trim();
      if (!trimmedLabel) throw new Error("Template name is required");
      if (!trimmedBody) throw new Error("Template body is required");

      const existing = parseInboxReplyTemplates(inbox.reply_templates);
      const nextTemplates = existing.map((entry) =>
        entry.id === template.id
          ? {
              ...entry,
              label: trimmedLabel,
              description: description.trim() || null,
              body: trimmedBody,
            }
          : entry,
      );

      return persistInboxReplyTemplates(inbox.id, nextTemplates);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ticket_inboxes"] });
      notify("Reply template updated", { type: "success" });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to update reply template",
        { type: "error" },
      );
    },
  });

  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit reply template</DialogTitle>
          <DialogDescription>
            Changes apply to{" "}
            <span className="font-medium text-foreground">
              {inbox?.display_name?.trim() || inbox?.email || "this inbox"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-reply-template-label">Name</Label>
            <Input
              id="edit-reply-template-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reply-template-description">
              Short description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="edit-reply-template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reply-template-body">Message</Label>
            <Textarea
              id="edit-reply-template-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !inbox?.id || !template?.id}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
