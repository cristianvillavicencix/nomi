import { useMemo, useState } from "react";
import {
  useDeleteWithUndoController,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
  useUpdate,
  type Identifier,
} from "ra-core";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ExternalLink,
  FileDown,
  FileText,
  HandMetal,
  Link2,
  ListChecks,
  MessageSquare,
  Phone,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { ShareRecordModal } from "@/components/atomic-crm/settings/ShareRecordModal";
import type { Contact } from "@/components/atomic-crm/types";
import type { LbsDeal } from "@/modules/types";
import { SendFormButton } from "@/modules/forms/share/SendFormButton";
import { getClientProposalCreatePath } from "@/app/routing";
import type { SendFormContext } from "@/modules/forms/share/sendFormTypes";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useProjectBriefActions } from "@/modules/deals/projects/ProjectBriefActionsProvider";
import { useMessagesQuickAccessOptional } from "@/modules/messages/messagesQuickAccessContext";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { VoiceDialDialog } from "@/modules/voice/VoiceDialDialog";

const getMainContactId = (record: LbsDeal) => {
  if (record.contact_id != null) return Number(record.contact_id);
  if (Array.isArray(record.contact_ids) && record.contact_ids.length > 0) {
    return Number(record.contact_ids[0]);
  }
  return null;
};

export const ProjectActionsMenu = ({
  record,
  onOpenTasks,
  onOpenPortal,
}: {
  record: LbsDeal;
  onOpenTasks?: () => void;
  onOpenPortal?: () => void;
}) => {
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const [shareOpen, setShareOpen] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);
  const {
    openRequestBrief,
    openFillAllSections,
    openManualHandoff,
    exportBrief,
    isManualHandoffActive,
  } = useProjectBriefActions();

  const contactId = getMainContactId(record);
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as number },
    { enabled: contactId != null },
  );

  const { smsEnabled, voiceEnabled } = useMessagingEnabled();
  const messagesQuickAccess = useMessagesQuickAccessOptional();
  const canSms =
    smsEnabled &&
    contact &&
    contactHasSmsPhone(contact) &&
    messagesQuickAccess != null;
  const canVoice =
    voiceEnabled &&
    hasMemberCapability(
      identity as AccessIdentity | undefined,
      "voice.calls.make",
    );

  const canManageSales = canUseCrmPermission(
    identity as Parameters<typeof canUseCrmPermission>[0],
    "sales.manage",
  );

  const { handleDelete, isPending: isDeleting } = useDeleteWithUndoController({
    record,
    resource: "deals",
    redirect: "list",
  });

  const sendFormContext = useMemo<SendFormContext>(
    () => ({
      type: "deal",
      deal_id: Number(record.id),
      company_id:
        record.company_id != null ? Number(record.company_id) : undefined,
      contact_id: contactId ?? undefined,
      resourceName: record.name,
    }),
    [contactId, record.company_id, record.id, record.name],
  );

  const archiveProject = () => {
    update(
      "deals",
      {
        id: record.id,
        data: { archived_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("Project archived", { type: "info" });
          refresh();
        },
        onError: () => notify("Could not archive project", { type: "error" }),
      },
    );
  };

  const restoreProject = () => {
    update(
      "deals",
      {
        id: record.id,
        data: { archived_at: null },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("Project restored", { type: "info" });
          refresh();
        },
        onError: () => notify("Could not restore project", { type: "error" }),
      },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            Actions
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          {onOpenTasks ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onOpenTasks();
              }}
            >
              <ListChecks className="size-4" />
              Open tasks
            </DropdownMenuItem>
          ) : null}
          {onOpenPortal ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onOpenPortal();
              }}
            >
              <ExternalLink className="size-4" />
              Client portal
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Client</DropdownMenuLabel>
          <SendFormButton
            context={sendFormContext}
            variant="menu-item"
            label="Send form"
          />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openRequestBrief();
            }}
          >
            <Link2 className="size-4" />
            Request brief from client
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              to={getClientProposalCreatePath(
                record.company_id,
                contactId,
                record.id,
              )}
            >
              <FileText className="size-4" />
              Create proposal
            </Link>
          </DropdownMenuItem>
          {canSms ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void messagesQuickAccess?.openSms(
                  contact,
                  record.id as Identifier,
                );
              }}
            >
              <MessageSquare className="size-4" />
              SMS client
            </DropdownMenuItem>
          ) : null}
          {canVoice ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setDialOpen(true);
              }}
            >
              <Phone className="size-4" />
              Call a number
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Brief</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openFillAllSections();
            }}
          >
            <Pencil className="size-4" />
            Fill all sections
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              exportBrief();
            }}
          >
            <FileDown className="size-4" />
            Export brief
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openManualHandoff();
            }}
          >
            <HandMetal className="size-4" />
            {isManualHandoffActive
              ? "Manual handoff (active)"
              : "Manual handoff"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setShareOpen(true);
            }}
          >
            <Share2 className="size-4" />
            Share with team
          </DropdownMenuItem>

          {canManageSales ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Admin</DropdownMenuLabel>
              {record.archived_at ? (
                <>
                  <DropdownMenuItem onSelect={() => restoreProject()}>
                    <ArchiveRestore className="size-4" />
                    Restore project
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={isDeleting}
                    onSelect={(event) => {
                      event.preventDefault();
                      handleDelete();
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete project
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      to={`/deals/${record.id}`}
                      className="flex cursor-default items-center gap-2"
                    >
                      <Pencil className="size-4" />
                      Edit project
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => archiveProject()}>
                    <Archive className="size-4" />
                    Archive project
                  </DropdownMenuItem>
                </>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareRecordModal
        resourceType="deals"
        resourceId={record.id}
        orgId={(record as { org_id?: number }).org_id}
        open={shareOpen}
        onOpenChange={setShareOpen}
        hideTrigger
      />
      <VoiceDialDialog open={dialOpen} onOpenChange={setDialOpen} />
    </>
  );
};
