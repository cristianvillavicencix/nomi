import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { TicketInbox } from "@/modules/types";
import { LBS_SUPPORT_SIGNATURE } from "@/modules/tickets/ticketReplyTemplates";
import { buildSignatureHtml } from "@/modules/tickets/ticketReplySignature";

type TicketInboxRow = Pick<
  TicketInbox,
  | "id"
  | "email"
  | "display_name"
  | "reply_signature_text"
  | "reply_signature_html"
>;

const loadTicketInboxes = async () => {
  const { data, error } = await supabase
    .from("ticket_inboxes")
    .select(
      "id, email, display_name, reply_signature_text, reply_signature_html",
    )
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TicketInboxRow[];
};

const inboxLabel = (inbox: TicketInboxRow) =>
  inbox.display_name?.trim()
    ? `${inbox.display_name} (${inbox.email})`
    : inbox.email;

export const TicketInboxReplySignatureSection = ({
  embedded,
}: {
  embedded?: boolean;
}) => {
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
    queryKey: ["ticket-inbox-signatures"],
    queryFn: loadTicketInboxes,
    enabled: canEdit,
  });

  const [selectedInboxId, setSelectedInboxId] = useState<string>("");
  const [signatureText, setSignatureText] = useState("");

  const selectedInbox = useMemo(
    () => inboxes.find((inbox) => String(inbox.id) === selectedInboxId),
    [inboxes, selectedInboxId],
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

  useEffect(() => {
    if (!selectedInbox) return;
    const stored =
      selectedInbox.reply_signature_text?.trim() ||
      (selectedInbox.reply_signature_html?.trim()
        ? selectedInbox.reply_signature_html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
        : "");
    setSignatureText(stored || LBS_SUPPORT_SIGNATURE);
  }, [selectedInbox]);

  const previewHtml = useMemo(
    () => buildSignatureHtml(signatureText.trim() || null),
    [signatureText],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInbox?.id) {
        throw new Error("Select a ticket inbox");
      }

      const trimmed = signatureText.trim();
      const useDefault = !trimmed || trimmed === LBS_SUPPORT_SIGNATURE;

      const { data, error: updateError } = await supabase
        .from("ticket_inboxes")
        .update({
          reply_signature_text: useDefault ? null : trimmed,
          reply_signature_html: null,
        })
        .eq("id", selectedInbox.id)
        .select(
          "id, email, display_name, reply_signature_text, reply_signature_html",
        )
        .single();

      if (updateError) throw updateError;
      return data as TicketInboxRow;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<TicketInboxRow[]>(
        ["ticket-inbox-signatures"],
        (current = []) =>
          current.map((inbox) => (inbox.id === saved.id ? saved : inbox)),
      );
      void queryClient.invalidateQueries({ queryKey: ["ticket_inboxes"] });
      notify("Ticket reply signature saved", { type: "success" });
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to save ticket reply signature",
        { type: "error" },
      );
    },
  });

  if (!canEdit) return null;

  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading ticket reply signature…
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
          <CardTitle className="text-base">Ticket reply signature</CardTitle>
          <CardDescription>
            No ticket inbox is configured for your organization yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const content = (
    <>
      {inboxes.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="ticket-inbox-signature-inbox">Inbox</Label>
            <Select value={selectedInboxId} onValueChange={setSelectedInboxId}>
              <SelectTrigger id="ticket-inbox-signature-inbox">
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
          <Label htmlFor="ticket-inbox-signature-text">Signature</Label>
          <Textarea
            id="ticket-inbox-signature-text"
            value={signatureText}
            onChange={(event) => setSignatureText(event.target.value)}
            rows={5}
            maxLength={800}
            placeholder={LBS_SUPPORT_SIGNATURE}
          />
          <p className="text-xs text-muted-foreground">
            {signatureText.length}/800 characters. Leave blank or reset to use
            the default LBS signature.
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Email preview
          </p>
          <div
            className="text-sm text-foreground [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !selectedInbox}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save signature
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSignatureText(LBS_SUPPORT_SIGNATURE)}
            disabled={saveMutation.isPending}
          >
            <RotateCcw className="size-4" />
            Reset to default
          </Button>
        </div>
    </>
  );

  if (embedded) {
    return (
      <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Reply signature</p>
          <p className="text-xs text-muted-foreground">
            Appended to outbound ticket replies from the composer.
          </p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ticket reply signature</CardTitle>
        <CardDescription>
          Appended to outbound ticket replies and forwards from the ticket
          composer. Plain text only — line breaks are preserved in the email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{content}</CardContent>
    </Card>
  );
};
