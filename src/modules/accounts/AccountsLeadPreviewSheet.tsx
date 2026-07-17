import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  getContactShowPath,
  getLeadShowPath,
  getPersonShowPath,
} from "@/app/routing";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Contact } from "@/components/atomic-crm/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { LeadOverviewPreview } from "@/modules/leads/LeadOverviewPreview";
import { normalizeLeadStage } from "@/modules/leads/leadStages";

/**
 * Shared person Sheet preview for Accounts List and Board.
 * Opens when `contact` or legacy `lead` is set (`stage` optional).
 */
export const AccountsLeadPreviewSheet = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const contactId =
    searchParams.get("contact") ?? searchParams.get("lead") ?? null;
  const stage = contactId
    ? normalizeLeadStage(searchParams.get("stage"))
    : null;
  const isLeadPreview = searchParams.has("lead");

  const clearSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("contact");
    next.delete("lead");
    next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!isMobile || !contactId) return;
    const path = isLeadPreview
      ? `${getLeadShowPath(contactId)}?stage=${encodeURIComponent(stage!)}`
      : getContactShowPath(contactId);
    navigate(path, { replace: true });
  }, [contactId, isLeadPreview, isMobile, navigate, stage]);

  return (
    <Sheet
      open={Boolean(contactId && stage) && !isMobile}
      onOpenChange={(open) => {
        if (!open) clearSelection();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[50vw] [&>button]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Person preview</SheetTitle>
        </SheetHeader>
        {contactId && stage ? (
          <LeadOverviewPreview
            leadId={contactId}
            stage={stage}
            onClose={clearSelection}
            fullViewPath={
              isLeadPreview
                ? getLeadShowPath(contactId)
                : getContactShowPath(contactId)
            }
            title={isLeadPreview ? "Lead Preview" : "Contact Preview"}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

/** @deprecated Prefer buildAccountsPersonPreviewParams */
export const buildAccountsLeadPreviewParams = (
  current: URLSearchParams,
  contactId: string | number,
  stage: string,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.set("lead", String(contactId));
  next.set("contact", String(contactId));
  next.set("stage", stage);
  return next;
};

/** Open person preview on the current Accounts hub URL (keeps list/board view). */
export const buildAccountsPersonPreviewParams = (
  current: URLSearchParams,
  contact: Pick<Contact, "id" | "status" | "lead_stage">,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  const id = String(contact.id);
  next.delete("company");
  next.set("contact", id);
  if (isLeadLifecycleStatus(contact.status)) {
    next.set("lead", id);
    next.set("stage", normalizeLeadStage(contact.lead_stage));
  } else {
    next.delete("lead");
    // Stage still required by LeadDetailPanel; normalize to a default.
    next.set("stage", normalizeLeadStage(contact.lead_stage));
  }
  return next;
};

export const getAccountsPersonFullPath = (
  contact: Pick<Contact, "id" | "status">,
) => getPersonShowPath(contact);
