import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useState } from "react";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { TicketInbox, TicketInboxReplyTemplate } from "@/modules/types";
import {
  createInboxReplyTemplateId,
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

type TicketReplyTemplateCreateDialogProps = {
  inbox: TicketInbox | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (template: TicketInboxReplyTemplate) => void;
};

export const TicketReplyTemplateCreateDialog = ({
  inbox,
  open,
  onOpenChange,
  onCreated,
}: TicketReplyTemplateCreateDialogProps) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;
  const canManageSettings = useMemberCapability("admin.settings.manage");
  const canManageTickets = useMemberCapability("support.tickets.manage");
  const canCreate = isAdmin || canManageSettings || canManageTickets;

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");

  const resetForm = () => {
    setLabel("");
    setDescription("");
    setBody("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!inbox?.id) {
        throw new Error("No ticket inbox selected");
      }

      const trimmedLabel = label.trim();
      const trimmedBody = body.trim();
      if (!trimmedLabel) throw new Error("Template name is required");
      if (!trimmedBody) throw new Error("Template body is required");

      const template: TicketInboxReplyTemplate = {
        id: createInboxReplyTemplateId(),
        label: trimmedLabel,
        description: description.trim() || null,
        body: trimmedBody,
      };

      const existing = parseInboxReplyTemplates(inbox.reply_templates);
      const nextTemplates = [...existing, template];

      const data = await persistInboxReplyTemplates(inbox.id, nextTemplates);
      return { template, row: data };
    },
    onSuccess: ({ template }) => {
      void queryClient.invalidateQueries({ queryKey: ["ticket_inboxes"] });
      notify("Reply template saved", { type: "success" });
      onCreated?.(template);
      resetForm();
      onOpenChange(false);
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to save reply template",
        { type: "error" },
      );
    },
  });

  if (!canCreate) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create reply template</DialogTitle>
          <DialogDescription>
            Saved for{" "}
            <span className="font-medium text-foreground">
              {inbox?.display_name?.trim() || inbox?.email || "this inbox"}
            </span>
            . Use variables like {"{{clientName}}"} and {"{{caseNumber}}"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reply-template-label">Name</Label>
            <Input
              id="reply-template-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Payment reminder"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply-template-description">
              Short description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="reply-template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Follow up when estimate is ready"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply-template-body">Message</Label>
            <Textarea
              id="reply-template-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              placeholder={
                "Hello {{clientName}},\n\nYour updated estimate for case {{caseNumber}} is ready."
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !inbox?.id}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
