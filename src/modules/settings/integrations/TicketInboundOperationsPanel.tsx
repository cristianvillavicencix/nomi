import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Loader2, RotateCcw, X } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type {
  TicketInboundFailureRow,
  TicketSettingsHealth,
} from "@/modules/settings/tickets/ticketWorkspaceSettings";
import {
  TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
} from "@/modules/settings/tickets/useTicketWorkspaceSettings";

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
};

const sourceLabel = (source: string) => {
  switch (source) {
    case "manual_import":
      return "Manual import";
    case "postmark":
      return "Postmark";
    default:
      return "SendGrid";
  }
};

const FailureRow = ({
  failure,
  onDismiss,
  onRetry,
  dismissing,
  retrying,
}: {
  failure: TicketInboundFailureRow;
  onDismiss: (id: number) => void;
  onRetry: (id: number) => void;
  dismissing: boolean;
  retrying: boolean;
}) => {
  const from =
    failure.from_name?.trim() ||
    failure.from_email?.trim() ||
    "Unknown sender";
  const skipped = failure.skipped_attachments ?? [];

  return (
    <div className="rounded-lg border bg-background p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{from}</p>
            <Badge variant="outline">{sourceLabel(failure.source)}</Badge>
            {failure.ticket_id ? (
              <Link
                to={`/tickets/${failure.ticket_id}/show`}
                className="font-medium text-primary hover:underline"
              >
                Ticket #{failure.ticket_id}
              </Link>
            ) : null}
          </div>
          {failure.subject ? (
            <p className="truncate text-muted-foreground">{failure.subject}</p>
          ) : null}
          <p className="text-foreground">{failure.error_message}</p>
          {skipped.length > 0 ? (
            <ul className="list-inside list-disc text-muted-foreground">
              {skipped.map((row) => (
                <li key={`${row.title}-${row.bytes}`}>
                  {row.title} ({formatBytes(row.bytes)})
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-muted-foreground">
            {new Date(failure.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {failure.can_retry ? (
            <IconButton
              variant="ghost"
              size="sm"
              label="Retry webhook"
              onClick={() => onRetry(failure.id)}
              disabled={retrying || dismissing}
            >
              <RotateCcw className="size-4" />
            </IconButton>
          ) : null}
          <IconButton
            variant="ghost"
            size="sm"
            label="Dismiss"
            onClick={() => onDismiss(failure.id)}
            disabled={dismissing || retrying}
          >
            <X className="size-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

type Props = {
  health: TicketSettingsHealth | undefined;
};

export const TicketInboundOperationsPanel = ({ health }: Props) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const dismissMutation = useMutation({
    mutationFn: (failureId: number) =>
      dataProvider.dismissTicketInboundFailure(failureId),
    onSuccess: (result) => {
      if (result.health) {
        queryClient.setQueryData(TICKET_WORKSPACE_SETTINGS_QUERY_KEY, (prev) =>
          prev && typeof prev === "object"
            ? { ...prev, health: result.health }
            : prev,
        );
      } else {
        void queryClient.invalidateQueries({
          queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
        });
      }
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to dismiss", {
        type: "error",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (failureId: number) =>
      dataProvider.retryTicketInboundFailure(failureId),
    onSuccess: (result) => {
      if (result.health) {
        queryClient.setQueryData(TICKET_WORKSPACE_SETTINGS_QUERY_KEY, (prev) =>
          prev && typeof prev === "object"
            ? { ...prev, health: result.health }
            : prev,
        );
      } else {
        void queryClient.invalidateQueries({
          queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
        });
      }
      if (result.ticket_id) {
        notify(`Ticket #${result.ticket_id} recovered`, { type: "success" });
      } else {
        notify("Inbound email reprocessed", { type: "success" });
      }
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Retry failed", {
        type: "error",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => dataProvider.importTicketEmail(file),
    onSuccess: (result) => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void queryClient.invalidateQueries({
        queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
      });
      const skipped =
        typeof result.skipped_attachments === "number" &&
        result.skipped_attachments > 0
          ? ` (${result.skipped_attachments} attachment(s) skipped)`
          : "";
      notify(`Ticket #${result.ticket_id} created${skipped}`, {
        type: "success",
      });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Import failed", {
        type: "error",
      });
    },
  });

  const failures = health?.recent_inbound_failures ?? [];
  const alertHours = health?.pipeline_alert_hours ?? 48;

  return (
    <div className="space-y-4">
      {health?.pipeline_stale ? (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertTriangle className="size-4 text-amber-700 dark:text-amber-300" />
          <AlertTitle className="text-amber-950 dark:text-amber-100">
            Inbound pipeline may be stalled
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
            {health.last_inbound_at
              ? `No inbound mail recorded in the last ${alertHours} hours (last: ${new Date(health.last_inbound_at).toLocaleString()}).`
              : `No inbound mail has been recorded yet. Check Hostinger forwarding, SendGrid Inbound Parse, and the Supabase webhook.`}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Manual recovery
          </p>
          <p className="text-xs text-muted-foreground">
            Import a saved <code className="rounded bg-muted px-1">.eml</code>{" "}
            file when SendGrid delivery failed or an attachment was skipped.
            Useful for recovering CompanyCam reports and other large mail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".eml,message/rfc822"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="mr-2 size-4" />
            Choose .eml file
          </Button>
          {selectedFile ? (
            <span className="truncate text-xs text-muted-foreground">
              {selectedFile.name}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!selectedFile || importMutation.isPending}
            onClick={() => {
              if (selectedFile) void importMutation.mutate(selectedFile);
            }}
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Import email
          </Button>
        </div>
      </section>

      {failures.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">
              Recent inbound failures
            </p>
            <p className="text-xs text-muted-foreground">
              Partial ingest warnings and delivery errors. Retry reprocesses the
              stored email body (attachments are not included). Dismiss after
              review.
            </p>
          </div>
          <div className="space-y-2">
            {failures.map((failure) => (
              <FailureRow
                key={failure.id}
                failure={failure}
                onDismiss={(id) => dismissMutation.mutate(id)}
                onRetry={(id) => retryMutation.mutate(id)}
                dismissing={dismissMutation.isPending}
                retrying={retryMutation.isPending}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
