import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { TicketInbox, TicketInboxReplyTemplate } from "@/modules/types";
import { TicketReplyTemplateCreateDialog } from "@/modules/tickets/TicketReplyTemplateCreateDialog";
import { TICKET_REPLY_TEMPLATES } from "@/modules/tickets/ticketReplyTemplates";
import {
  parseInboxReplyTemplates,
  persistInboxReplyTemplates,
} from "@/modules/tickets/ticketReplyTemplateStorage";
import { TicketReplyTemplateEditDialog } from "@/modules/tickets/TicketReplyTemplateEditDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TicketInboxRow = Pick<
  TicketInbox,
  "id" | "email" | "display_name" | "reply_templates"
>;

const loadTicketInboxes = async () => {
  const { data, error } = await supabase
    .from("ticket_inboxes")
    .select("id, email, display_name, reply_templates")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TicketInboxRow[];
};

const inboxLabel = (inbox: TicketInboxRow) =>
  inbox.display_name?.trim()
    ? `${inbox.display_name} (${inbox.email})`
    : inbox.email;

export const TicketInboxReplyTemplatesSection = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;
  const canManageSettings = useMemberCapability("admin.settings.manage");
  const canManageTickets = useMemberCapability("support.tickets.manage");
  const canEdit = isAdmin || canManageSettings || canManageTickets;

  const {
    data: inboxes = [],
    isPending,
    error,
  } = useQuery({
    queryKey: ["ticket-inbox-reply-templates"],
    queryFn: loadTicketInboxes,
    enabled: canEdit,
  });

  const [selectedInboxId, setSelectedInboxId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<TicketInboxReplyTemplate | null>(null);

  const selectedInbox = useMemo(
    () => inboxes.find((inbox) => String(inbox.id) === selectedInboxId),
    [inboxes, selectedInboxId],
  );

  const customTemplates = useMemo(
    () => parseInboxReplyTemplates(selectedInbox?.reply_templates),
    [selectedInbox?.reply_templates],
  );

  useEffect(() => {
    if (!inboxes.length) return;
    setSelectedInboxId((current) => {
      if (current && inboxes.some((inbox) => String(inbox.id) === current)) {
        return current;
      }
      return String(inboxes[0].id);
    });
  }, [inboxes]);

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!selectedInbox?.id) throw new Error("Select a ticket inbox");
      const nextTemplates = customTemplates.filter(
        (template) => template.id !== templateId,
      );
      return persistInboxReplyTemplates(selectedInbox.id, nextTemplates);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ticket-inbox-reply-templates"],
      });
      void queryClient.invalidateQueries({ queryKey: ["ticket_inboxes"] });
      notify("Reply template deleted", { type: "success" });
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to delete reply template",
        { type: "error" },
      );
    },
  });

  if (!canEdit) return null;

  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading ticket reply templates…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load ticket inboxes. Apply the latest database migration.
      </p>
    );
  }

  if (!inboxes.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticket reply templates</CardTitle>
          <CardDescription>
            No ticket inbox is configured for your organization yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticket reply templates</CardTitle>
          <CardDescription>
            Custom templates appear in the ticket reply composer. Built-in
            templates are shared across all inboxes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {inboxes.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="ticket-inbox-templates-inbox">Inbox</Label>
              <Select
                value={selectedInboxId}
                onValueChange={setSelectedInboxId}
              >
                <SelectTrigger id="ticket-inbox-templates-inbox">
                  <SelectValue placeholder="Select inbox" />
                </SelectTrigger>
                <SelectContent>
                  {inboxes.map((inbox) => (
                    <SelectItem key={inbox.id} value={String(inbox.id)}>
                      {inboxLabel(inbox)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : selectedInbox ? (
            <p className="text-sm text-muted-foreground">
              Inbox:{" "}
              <span className="font-medium text-foreground">
                {inboxLabel(selectedInbox)}
              </span>
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Built-in templates
            </p>
            <ul className="divide-y rounded-md border">
              {TICKET_REPLY_TEMPLATES.map((template) => (
                <li
                  key={template.id}
                  className="flex items-start justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{template.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Built-in
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Custom templates
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!selectedInbox}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
                Add template
              </Button>
            </div>

            {customTemplates.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No custom templates yet. Add one here or from the ticket reply
                composer.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {customTemplates.map((template) => (
                  <li
                    key={template.id}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{template.label}</p>
                      {template.description ? (
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Edit template"
                        onClick={() => setEditingTemplate(template)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        title="Delete template"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(template.id)}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <TicketReplyTemplateCreateDialog
        inbox={selectedInbox ?? null}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          void queryClient.invalidateQueries({
            queryKey: ["ticket-inbox-reply-templates"],
          });
        }}
      />

      <TicketReplyTemplateEditDialog
        inbox={selectedInbox ?? null}
        template={editingTemplate}
        open={editingTemplate != null}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null);
        }}
        onSaved={() => {
          void queryClient.invalidateQueries({
            queryKey: ["ticket-inbox-reply-templates"],
          });
        }}
      />
    </>
  );
};
